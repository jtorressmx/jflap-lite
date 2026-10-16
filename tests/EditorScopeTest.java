import automata.Automaton;
import automata.State;
import automata.fsa.FSATransition;
import automata.fsa.FiniteStateAutomaton;
import automata.turing.TMTransition;
import automata.turing.TuringMachine;
import automata.turing.TuringMachineBuildingBlocks;
import gui.action.MultipleSimulateAction;
import gui.action.NewAction;
import gui.action.SimulateAction;
import gui.editor.EditorPane;
import gui.environment.EnvironmentFrame;
import gui.environment.FrameFactory;
import gui.environment.Universe;
import java.awt.Component;
import java.awt.Frame;
import java.awt.Graphics2D;
import java.awt.GraphicsEnvironment;
import java.awt.Point;
import java.awt.Window;
import java.awt.image.BufferedImage;
import java.io.File;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import javax.imageio.ImageIO;
import javax.swing.JButton;
import javax.swing.JFrame;
import javax.swing.JMenu;
import javax.swing.JMenuItem;
import javax.swing.SwingUtilities;
import org.junit.Assume;
import org.junit.Test;
import static org.junit.Assert.*;

public class EditorScopeTest {
    @Test
    public void selectorAndEditorsOnlyExposeSupportedMachines() throws Exception {
        Assume.assumeFalse("Requires a desktop display", GraphicsEnvironment.isHeadless());
        SwingUtilities.invokeAndWait(() -> {
            List<EnvironmentFrame> frames = new ArrayList<>();
            try {
                NewAction.showNew();
                JFrame selector = null;
                for (Frame frame : Frame.getFrames()) {
                    if (frame instanceof JFrame && "JFLAP 7.1".equals(frame.getTitle())) selector = (JFrame) frame;
                }
                assertNotNull(selector);
                Set<String> choices = new HashSet<>();
                JButton finite = null;
                for (Component component : selector.getContentPane().getComponents()) {
                    if (component instanceof JButton) {
                        JButton button = (JButton) component;
                        choices.add(button.getText());
                        if ("Finite Automaton".equals(button.getText())) finite = button;
                    }
                }
                assertEquals(new HashSet<>(Arrays.asList("Finite Automaton", "Turing Machine",
                        "Multi-Tape Turing Machine", "Turing Machine With Building Blocks")), choices);
                capture(selector, "selector");
                assertNotNull(finite);
                finite.doClick();
                for (Frame frame : Frame.getFrames()) {
                    if (frame instanceof EnvironmentFrame && frame.isVisible()) {
                        frames.add((EnvironmentFrame) frame);
                    }
                }
                assertEquals(1, frames.size());
                verifyEditor(frames.get(0), "finite");
                for (TuringMachine machine : new TuringMachine[]{new TuringMachine(1), new TuringMachine(2),
                        new TuringMachineBuildingBlocks(1)}) {
                    State start = machine.createState(new Point(80, 100));
                    State end = machine.createState(new Point(240, 100));
                    machine.setInitialState(start);
                    machine.addFinalState(end);
                    String[] symbols = new String[machine.tapes()];
                    String[] moves = new String[machine.tapes()];
                    Arrays.fill(symbols, "a");
                    Arrays.fill(moves, "R");
                    machine.addTransition(new TMTransition(start, end, symbols, symbols, moves));
                    EnvironmentFrame frame = FrameFactory.createFrame(machine);
                    frames.add(frame);
                    verifyEditor(frame, machine instanceof TuringMachineBuildingBlocks ? "blocks" : "turing-" + machine.tapes());
                }
            } finally {
                for (EnvironmentFrame frame : frames) Universe.unregisterFrame(frame);
                for (Window window : Window.getWindows()) window.dispose();
                NewAction.closeNew();
            }
        });
    }

    private void verifyEditor(EnvironmentFrame frame, String image) {
        assertTrue(frame.getEnvironment().getActive() instanceof EditorPane);
        Set<String> actions = new HashSet<>();
        for (int menu = 0; menu < frame.getJMenuBar().getMenuCount(); menu++) {
            collect(frame.getJMenuBar().getMenu(menu), actions);
        }
        assertTrue(actions.contains("Export to SVG"));
        assertTrue(actions.contains("Fast Run..."));
        for (String action : actions) {
            assertFalse(action, action.matches("(?i).*(grammar|pda|mealy|moore|parse|regular expression|l-system|pumping).*"));
        }
        Automaton machine = (Automaton) frame.getEnvironment().getObject();
        if (machine instanceof FiniteStateAutomaton) {
            State start = machine.createState(new Point(80, 100));
            State end = machine.createState(new Point(240, 100));
            machine.setInitialState(start);
            machine.addFinalState(end);
            machine.addTransition(new FSATransition(start, end, "a"));
            assertTrue(actions.contains("Convert to DFA"));
        }
        capture(frame, image);
        new MultipleSimulateAction(machine, frame.getEnvironment()).performAction(frame);
        assertEquals("Multiple Run", frame.getEnvironment().tabbed.getTitleAt(frame.getEnvironment().tabbed.getSelectedIndex()));
        new SimulateAction(machine, frame.getEnvironment()).handleInteraction(machine,
                automata.SimulatorFactory.getSimulator(machine),
                automata.SimulatorFactory.getSimulator(machine).getInitialConfigurations("a"), "a");
        assertTrue(frame.getEnvironment().getActive() instanceof gui.sim.SimulatorPane);
    }

    private void collect(JMenu menu, Set<String> actions) {
        if (menu == null) return;
        for (int index = 0; index < menu.getItemCount(); index++) {
            JMenuItem item = menu.getItem(index);
            if (item == null) continue;
            actions.add(item.getText());
            if (item instanceof JMenu) collect((JMenu) item, actions);
        }
    }

    private void capture(JFrame frame, String name) {
        BufferedImage image = new BufferedImage(frame.getWidth(), frame.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        try {
            frame.paint(graphics);
            File output = new File("target/ui-smoke/" + name + ".png");
            output.getParentFile().mkdirs();
            ImageIO.write(image, "png", output);
        } catch (java.io.IOException exception) {
            throw new AssertionError(exception);
        } finally {
            graphics.dispose();
        }
    }
}
