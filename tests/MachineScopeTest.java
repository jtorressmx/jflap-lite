import automata.Automaton;
import automata.AutomatonSimulator;
import automata.Configuration;
import automata.SimulatorFactory;
import automata.State;
import automata.fsa.FSANondeterminismDetector;
import automata.fsa.FSAStepWithClosureSimulator;
import automata.fsa.FSATransition;
import automata.fsa.FiniteStateAutomaton;
import automata.fsa.Minimizer;
import automata.fsa.NFAToDFA;
import automata.turing.NDTMSimulator;
import automata.turing.TMConfiguration;
import automata.turing.TMTransition;
import automata.turing.TMSimulator;
import automata.turing.TuringMachine;
import file.XMLCodec;
import file.xml.TMTransducer;
import file.xml.TransducerFactory;
import gui.environment.Universe;
import java.awt.Point;
import java.io.File;
import java.nio.file.Files;
import java.util.ArrayList;
import javax.xml.parsers.DocumentBuilderFactory;
import org.junit.Test;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import static org.junit.Assert.*;

public class MachineScopeTest {
    private State[] states(Automaton machine) {
        State start = machine.createState(new Point(50, 50));
        State end = machine.createState(new Point(150, 50));
        machine.setInitialState(start);
        machine.addFinalState(end);
        return new State[]{start, end};
    }

    @Test
    public void lambdaNfaConvertsToEquivalentDfaAndMinimizes() {
        FiniteStateAutomaton nfa = new FiniteStateAutomaton();
        State[] pair = states(nfa);
        State middle = nfa.createState(new Point(100, 100));
        nfa.addTransition(new FSATransition(pair[0], middle, ""));
        nfa.addTransition(new FSATransition(middle, pair[1], "a"));
        nfa.addTransition(new FSATransition(pair[1], pair[1], "a"));
        FiniteStateAutomaton dfa = new NFAToDFA().convertToDFA(nfa);
        assertEquals(0, new FSANondeterminismDetector().getNondeterministicStates(dfa).length);
        Minimizer minimizer = new Minimizer();
        minimizer.initializeMinimizer();
        Automaton complete = minimizer.getMinimizeableAutomaton(dfa);
        FiniteStateAutomaton minimum = minimizer.getMinimumDfa(complete,
                minimizer.getDistinguishableGroupsTree(complete));
        FSAStepWithClosureSimulator simulator = new FSAStepWithClosureSimulator(minimum);
        assertTrue(simulator.simulateInput("aaa"));
        assertFalse(simulator.simulateInput(""));
        assertFalse(simulator.simulateInput("b"));
    }

    @Test
    public void singleTapeTuringStepsAndRoundTrips() throws Exception {
        TuringMachine machine = new TuringMachine(1);
        State[] pair = states(machine);
        machine.addTransition(new TMTransition(pair[0], pair[1], "a", "x", "R"));
        TuringMachine recovered = (TuringMachine) new TMTransducer().fromDOM(new TMTransducer().toDOM(machine));
        assertEquals(1, recovered.tapes());
        assertEquals(2, recovered.getStates().length);
        assertAcceptingStep(recovered, new String[]{"a"}, "x");
    }

    @Test
    public void singleTapeJffRoundTrips() throws Exception {
        TuringMachine machine = new TuringMachine();
        State[] pair = states(machine);
        machine.addTransition(new TMTransition(pair[0], pair[1], "a", "x", "R"));
        pair[0].setLabel("Start here");
        File document = Files.createTempFile("jflap-turing-", ".jff").toFile();
        try {
            XMLCodec codec = new XMLCodec();
            codec.encode(machine, document, null);
            TuringMachine recovered = (TuringMachine) codec.decode(document, null);
            assertEquals(1, recovered.tapes());
            assertEquals("Start here", recovered.getInitialState().getLabel());
            assertAcceptingStep(recovered, new String[]{"a"}, "x");
        } finally {
            Files.deleteIfExists(document.toPath());
        }
    }

    private void assertAcceptingStep(TuringMachine machine, String[] input, String... output) {
        boolean finalState = Universe.curProfile.getAcceptByFinalState();
        boolean halting = Universe.curProfile.getAcceptByHalting();
        try {
            Universe.curProfile.setAcceptByFinalState(true);
            Universe.curProfile.setAcceptByHalting(false);
            TMSimulator simulator = new TMSimulator(machine);
            Configuration initial = simulator.getInitialConfigurations(input)[0];
            ArrayList<Configuration> next = simulator.stepConfiguration(initial);
            assertFalse(next.isEmpty());
            for (Configuration configuration : next) {
                TMConfiguration accepted = (TMConfiguration) configuration;
                assertSame(initial, accepted.getParent());
                assertTrue(accepted.isAccept());
                for (int tape = 0; tape < output.length; tape++) {
                    int writtenPosition = accepted.getTapes()[tape].getTapeHead() - 1;
                    assertEquals(output[tape].charAt(0), accepted.getTapes()[tape].getContents().charAt(writtenPosition));
                }
            }
        } finally {
            Universe.curProfile.setAcceptByFinalState(finalState);
            Universe.curProfile.setAcceptByHalting(halting);
        }
    }

    @Test
    public void nondeterministicTuringKeepsBothBranches() {
        TuringMachine machine = new TuringMachine(1);
        State[] pair = states(machine);
        State dead = machine.createState(new Point(150, 150));
        machine.addTransition(new TMTransition(pair[0], pair[1], "a", "a", "R"));
        machine.addTransition(new TMTransition(pair[0], dead, "a", "a", "R"));
        AutomatonSimulator simulator = SimulatorFactory.getSimulator(machine);
        assertTrue(simulator instanceof NDTMSimulator);
        ArrayList<Configuration> next = simulator.stepConfiguration(simulator.getInitialConfigurations("a")[0]);
        assertEquals(2, next.size());
        assertTrue(next.stream().anyMatch(Configuration::isAccept));
    }

    @Test
    public void multiTapeModelsTransitionsAndInputsAreRejected() {
        assertThrows(IllegalArgumentException.class, () -> new TuringMachine(2));
        TuringMachine machine = new TuringMachine();
        State[] pair = states(machine);
        assertThrows(IllegalArgumentException.class, () -> new TMTransition(pair[0], pair[1],
                new String[]{"a", "b"}, new String[]{"a", "b"}, new String[]{"R", "R"}));
        assertThrows(IllegalArgumentException.class, () -> new TMSimulator(machine)
                .getInitialConfigurations(new String[]{"a", "b"}));
        assertThrows(IllegalArgumentException.class, () -> new NDTMSimulator(machine)
                .getInitialConfigurations(new String[]{"a", "b"}));
    }

    @Test
    public void multiTapeAndBlockDocumentsAreRejected() throws Exception {
        for (String content : new String[]{"<tapes>2</tapes>", "<block id='0'/>",
                "<state id='0'><tag>nestedMachine</tag></state>", "<transition block='true'/>",
                "<tapes>1</tapes><tapes>1</tapes>",
                "<state id='0'/><transition><from>0</from><to>0</to><read tape='2'>a</read></transition>",
                "<state id='0'/><transition><from>0</from><to>0</to><read>a</read><read>b</read></transition>"}) {
            File file = Files.createTempFile("jflap-removed-turing-", ".jff").toFile();
            try {
                Files.write(file.toPath(), ("<structure><type>turing</type><automaton>" + content
                        + "</automaton></structure>").getBytes(java.nio.charset.StandardCharsets.UTF_8));
                assertThrows(content, file.ParseException.class, () -> new XMLCodec().decode(file, null));
            } finally {
                Files.deleteIfExists(file.toPath());
            }
        }
    }

    @Test
    public void standardTuringCloneAndRestorePreserveStatesAndTransitions() {
        TuringMachine machine = new TuringMachine();
        State[] pair = states(machine);
        pair[0].setLabel("Start");
        machine.addTransition(new TMTransition(pair[0], pair[1], "a", "x", "R"));
        TuringMachine copy = (TuringMachine) machine.clone();
        assertNotSame(machine.getInitialState(), copy.getInitialState());
        assertEquals("Start", copy.getInitialState().getLabel());
        machine.removeState(pair[1]);
        Automaton.become(machine, copy);
        assertEquals(2, machine.getStates().length);
        assertEquals(1, machine.getTransitions().length);
        assertAcceptingStep(machine, new String[]{"a"}, "x");
    }

    @Test
    public void standardTuringSimulationAcceptsAndRejects() {
        boolean finalState = Universe.curProfile.getAcceptByFinalState();
        boolean halting = Universe.curProfile.getAcceptByHalting();
        try {
            Universe.curProfile.setAcceptByFinalState(true);
            Universe.curProfile.setAcceptByHalting(false);
            TuringMachine machine = new TuringMachine();
            State[] pair = states(machine);
            machine.addTransition(new TMTransition(pair[0], pair[1], "a", "x", "R"));
            TMSimulator simulator = new TMSimulator(machine);
            assertTrue(simulator.simulateInput("a"));
            assertFalse(simulator.simulateInput("b"));
            Universe.curProfile.setAcceptByFinalState(false);
            Universe.curProfile.setAcceptByHalting(true);
            assertTrue(new TMSimulator(machine).simulateInput("b"));
        } finally {
            Universe.curProfile.setAcceptByFinalState(finalState);
            Universe.curProfile.setAcceptByHalting(halting);
        }
    }

    @Test
    public void removedDocumentTypesCannotBeOpenedEvenWithTuringTags() throws Exception {
        for (String type : new String[]{"pda", "mealy", "moore", "grammar", "re", "lsystem", "turingbb", "unknown"}) {
            Document document = DocumentBuilderFactory.newInstance().newDocumentBuilder().newDocument();
            Element root = document.createElement("structure");
            document.appendChild(root);
            Element tag = document.createElement("type");
            tag.setTextContent(type);
            root.appendChild(tag);
            root.appendChild(document.createElement("block"));
            root.appendChild(document.createElement("tapes"));
            assertThrows(IllegalArgumentException.class, () -> TransducerFactory.getTransducer(document));
        }
    }

    @Test
    public void removedClassesAndResourcesAreAbsent() {
        for (String name : new String[]{"automata.pda.PushdownAutomaton", "automata.mealy.MealyMachine",
                "grammar.Grammar", "regular.RegularExpression", "pumping.PumpingLemma", "gui.WebFrame",
                "automata.turing.TMState", "automata.turing.TuringMachineBuildingBlocks", "file.xml.TMBBTransducer",
                "gui.editor.BuildingBlockTool", "gui.editor.BlockTransitionTool", "gui.editor.EditBlockPane",
                "gui.action.BuildingBlockSimulateAction"}) {
            assertThrows(ClassNotFoundException.class, () -> Class.forName(name));
        }
        assertNull(gui.Main.class.getResource("/DOCS/gui.grammar.GrammarInputPane.html"));
        assertNull(gui.Main.class.getResource("/MEDIA/about_2008.png"));
        assertNull(gui.Main.class.getResource("/org/foo.txt"));
        assertNull(gui.Main.class.getResource("/ICON/blocks.gif"));
        assertNull(gui.Main.class.getResource("/ICON/blockTransition.gif"));
    }

    @Test
    public void unsupportedFilesReportAParseErrorAndCannotBeEncoded() throws Exception {
        File document = Files.createTempFile("jflap-unsupported-", ".jff").toFile();
        try {
            Files.write(document.toPath(), "<structure><type>pda</type></structure>".getBytes(java.nio.charset.StandardCharsets.UTF_8));
            assertThrows(file.ParseException.class, () -> new XMLCodec().decode(document, null));
            assertFalse(new XMLCodec().canEncode("unsupported"));
        } finally {
            Files.deleteIfExists(document.toPath());
        }
    }
}
