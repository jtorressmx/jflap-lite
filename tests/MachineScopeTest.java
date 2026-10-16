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
import automata.turing.TMState;
import automata.turing.TMTransition;
import automata.turing.TMSimulator;
import automata.turing.TuringMachine;
import automata.turing.TuringMachineBuildingBlocks;
import file.XMLCodec;
import file.xml.TMBBTransducer;
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
    public void multiTapeTuringStepsAndJffRoundTrips() throws Exception {
        TuringMachine machine = new TuringMachine(2);
        State[] pair = states(machine);
        machine.addTransition(new TMTransition(pair[0], pair[1],
                new String[]{"a", "b"}, new String[]{"x", "y"}, new String[]{"R", "R"}));
        File document = Files.createTempFile("jflap-multitape-", ".jff").toFile();
        try {
            XMLCodec codec = new XMLCodec();
            codec.encode(machine, document, null);
            TuringMachine recovered = (TuringMachine) codec.decode(document, null);
            assertEquals(2, recovered.tapes());
            assertAcceptingStep(recovered, new String[]{"a", "b"}, "x", "y");
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
    public void nestedTuringBlocksRoundTrip() {
        TuringMachineBuildingBlocks outer = new TuringMachineBuildingBlocks(1);
        TMState block = outer.createTMState(new Point(100, 100));
        block.setName("Read a");
        block.setInternalName("ReadA");
        outer.setInitialState(block);
        outer.addFinalState(block);
        TuringMachine inner = block.getInnerTM();
        State[] pair = states(inner);
        inner.addTransition(new TMTransition(pair[0], pair[1], "a", "a", "R"));
        TMBBTransducer codec = new TMBBTransducer();
        Document document = codec.toDOM(outer);
        assertTrue(document.getElementsByTagName("block").getLength() > 0);
        assertTrue(TransducerFactory.getTransducer(document) instanceof TMBBTransducer);
        TuringMachineBuildingBlocks recovered = (TuringMachineBuildingBlocks) codec.fromDOM(document);
        TMState recoveredBlock = (TMState) recovered.getInitialState();
        assertEquals(2, recoveredBlock.getInnerTM().getStates().length);
        assertEquals(1, recoveredBlock.getInnerTM().getTransitions().length);
    }

    @Test
    public void removedDocumentTypesCannotBeOpenedEvenWithTuringTags() throws Exception {
        for (String type : new String[]{"pda", "mealy", "moore", "grammar", "re", "lsystem", "unknown"}) {
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
                "grammar.Grammar", "regular.RegularExpression", "pumping.PumpingLemma", "gui.WebFrame"}) {
            assertThrows(ClassNotFoundException.class, () -> Class.forName(name));
        }
        assertNull(gui.Main.class.getResource("/DOCS/gui.grammar.GrammarInputPane.html"));
        assertNull(gui.Main.class.getResource("/MEDIA/about_2008.png"));
        assertNull(gui.Main.class.getResource("/org/foo.txt"));
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
