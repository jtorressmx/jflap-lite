import automata.State;
import automata.fsa.FSATransition;
import automata.fsa.FSAStepWithClosureSimulator;
import automata.fsa.FiniteStateAutomaton;
import file.XMLCodec;
import java.awt.Point;
import java.io.File;
import java.io.StringWriter;
import java.nio.file.Files;
import org.apache.batik.dom.svg.SVGDOMImplementation;
import org.apache.batik.svggen.SVGGraphics2D;
import org.junit.Test;
import org.w3c.dom.Document;
import static org.junit.Assert.*;

/** Checks that the recovered sources, resources and external SVG API work together. */
public class BuildSmokeTest {
    private FiniteStateAutomaton automaton() {
        FiniteStateAutomaton machine = new FiniteStateAutomaton();
        State start = machine.createState(new Point(50, 50));
        State end = machine.createState(new Point(150, 50));
        machine.setInitialState(start);
        machine.addFinalState(end);
        machine.addTransition(new FSATransition(start, end, "a"));
        machine.addTransition(new FSATransition(end, end, "a"));
        return machine;
    }

    @Test
    public void simulatorAcceptsAndRejectsInputs() {
        FSAStepWithClosureSimulator simulator = new FSAStepWithClosureSimulator(automaton());
        assertTrue(simulator.simulateInput("a"));
        assertTrue(simulator.simulateInput("aaa"));
        assertFalse(simulator.simulateInput(""));
        assertFalse(simulator.simulateInput("b"));
    }

    @Test
    public void jffRoundTripPreservesSimulation() throws Exception {
        File document = Files.createTempFile("jflap-build-", ".jff").toFile();
        try {
            XMLCodec codec = new XMLCodec();
            codec.encode(automaton(), document, null);
            FiniteStateAutomaton recovered = (FiniteStateAutomaton) codec.decode(document, null);
            assertEquals(2, recovered.getStates().length);
            assertTrue(new FSAStepWithClosureSimulator(recovered).simulateInput("aa"));
            assertFalse(new FSAStepWithClosureSimulator(recovered).simulateInput("b"));
        } finally {
            Files.deleteIfExists(document.toPath());
        }
    }

    @Test
    public void resourcesRemainOnClasspath() {
        for (String path : new String[]{"/ICON/state.gif", "/MEDIA/about.png",
                "/DOCS/error.html", "/LICENSE"}) {
            assertNotNull("Missing resource: " + path, gui.Main.class.getResource(path));
        }
    }

    @Test
    public void legacyBatikCanGenerateSvg() throws Exception {
        Document document = SVGDOMImplementation.getDOMImplementation().createDocument(
                SVGDOMImplementation.SVG_NAMESPACE_URI, "svg", null);
        SVGGraphics2D generator = new SVGGraphics2D(document);
        try {
            generator.drawRect(0, 0, 20, 20);
            StringWriter result = new StringWriter();
            generator.stream(result, true);
            assertTrue(result.toString().contains("<svg"));
            assertTrue(result.toString().contains("<rect"));
        } finally {
            generator.dispose();
        }
    }
}
