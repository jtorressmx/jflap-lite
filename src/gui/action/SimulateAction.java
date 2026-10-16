/*
 *  JFLAP - Formal Languages and Automata Package
 * 
 * 
 *  Susan H. Rodger
 *  Computer Science Department
 *  Duke University
 *  August 27, 2009

 *  Copyright (c) 2002-2009
 *  All rights reserved.

 *  JFLAP is open source software. Please see the LICENSE for terms.
 *
 */
package gui.action;

import automata.Automaton;
import automata.AutomatonSimulator;
import automata.Configuration;
import automata.SimulatorFactory;
import gui.environment.Environment;
import gui.environment.Universe;
import java.awt.event.ActionEvent;
import java.awt.event.KeyEvent;
import gui.sim.SimulatorPane;
import gui.environment.tag.CriticalTag;
import javax.swing.*;
import java.awt.GridLayout;
import java.awt.Component;
import java.io.*;
import automata.graph.AutomatonDirectedGraph;
import automata.turing.TuringMachine;

/**
 * This is the action used for the stepwise simulation of data. This method can
 * operate on any supported automaton.
 *
 * @author Thomas Finley
 */
public class SimulateAction extends AutomatonAction {

    private static final long serialVersionUID = 1L;

    /**
     * Instantiates a new <CODE>SimulateAction</CODE>.
     *
     * @param automaton
     *            the automaton that input will be simulated on
     * @param environment
     *            the environment object that we shall add our simulator pane to
     */
    public SimulateAction(Automaton automaton, Environment environment) {
        super("Step...", null);
        if (SimulateNoClosureAction.isApplicable(automaton))
            putValue(NAME, "Step with Closure...");
        putValue(ACCELERATOR_KEY, KeyStroke.getKeyStroke(KeyEvent.VK_R, MAIN_MENU_MASK));
        this.automaton = automaton;
        this.environment = environment;
    }

    /**
     * Returns the simulator for this automaton.
     *
     * @param automaton
     *            the automaton to get the simulator for
     * @return a simulator for this automaton
     */
    protected AutomatonSimulator getSimulator(Automaton automaton) {
        return SimulatorFactory.getSimulator(automaton);
    }

    /**
     * Given initial configurations, the simulator, and the automaton, takes any
     * further action that may be necessary. In the case of stepwise operation,
     * which is the default, an additional tab is added to the environment
     *
     * @param automaton
     *            the automaton input is simulated on
     * @param simulator
     *            the automaton simulator for this automaton
     * @param configurations
     *            the initial configurations generated
     * @param initialInput
     *            the input string
     */
    public void handleInteraction(Automaton automaton, AutomatonSimulator simulator, Configuration[] configurations, Object initialInput) {
        SimulatorPane simpane = new SimulatorPane(automaton, simulator, configurations, environment);
        if (initialInput instanceof String[])
            initialInput = java.util.Arrays.asList((String[]) initialInput);
        environment.add(simpane, "Simulate: " + initialInput, new CriticalTag() {
        });
        environment.setActive(simpane);
    }

    /**
     * Prompts for the input string, optionally loaded from a text file.
     *
     * @param component
     *            a parent for whatever dialogs are brought up
     * @return the object that represents the initial input to the machine, or
     *         <CODE>null</CODE> if the user elected to cancel
     */
    protected Object initialInput(Component component, String title) {
        if (title.isEmpty())
            title = "Input";
        return openInputGUI(component, title);
    }

    /**
     * Opens pop-up GUI for taking input. Now JFLAP can take file as an input.
     * @param component
     * @param title
     * @return
     */
    private Object openInputGUI(final Component component, String title) {
        JPanel panel = new JPanel(new GridLayout(3, 1));
        JTextField field = new JTextField();
        panel.add(new JLabel(title));
        panel.add(field);
        JButton open = new JButton("Open Input File...");
        open.addActionListener(event -> {
            JFileChooser chooser = new JFileChooser(System.getProperty("user.dir"));
            if (chooser.showOpenDialog(component) != JFileChooser.APPROVE_OPTION)
                return;
            try (BufferedReader reader = new BufferedReader(new FileReader(chooser.getSelectedFile()))) {
                String line = reader.readLine();
                field.setText(line == null ? "" : line);
            } catch (IOException error) {
                JOptionPane.showMessageDialog(component, error.getMessage(), "File read error", JOptionPane.ERROR_MESSAGE);
            }
        });
        panel.add(open);
        int result = JOptionPane.showConfirmDialog(component, panel, title, JOptionPane.OK_CANCEL_OPTION, JOptionPane.QUESTION_MESSAGE);
        return result == JOptionPane.OK_OPTION ? field.getText() : null;
    }

    /**
     * Performs the action.
     */
    public void actionPerformed(ActionEvent e) {
        if (!automatonActionPermissible((Component) e.getSource()))
            return;
        Object input = initialInput((Component) e.getSource(), "");
        if (input == null)
            return;
        AutomatonSimulator simulator = getSimulator(automaton);
        Configuration[] configs = simulator.getInitialConfigurations((String) input);
        handleInteraction(automaton, simulator, configs, input);
    }

    /**
     * Returns whether the current automaton can legally be simulated.  If not,
     * a dialog pops up.  Will true if <code>automaton</code> = <i>null</i>.
     *
     * @param source
     * 		the source of this action
     * @return whether the current automaton can legally be simulated
     */
    protected boolean automatonActionPermissible(Component source) {
        if (!(getObject() instanceof Automaton))
            return true;
        if (automaton.getInitialState() == null) {
            JOptionPane.showMessageDialog(source, "Simulation requires an automaton\n" + "with an initial state!", "No Initial State", JOptionPane.ERROR_MESSAGE);
            return false;
        }
        /*
         * If it is a Turing machine, there are transitions from the final state, and that preference
         * hasn't been enabled, give a warning and return. 
         */
        if (automaton instanceof TuringMachine && !Universe.curProfile.transitionsFromTuringFinalStateAllowed()) {
            TuringMachine turingMachine = (TuringMachine) automaton;
            Object[] finalStates = turingMachine.getFinalStates();
            AutomatonDirectedGraph graph = new AutomatonDirectedGraph(turingMachine);
            for (int i = 0; i < finalStates.length; i++) if (graph.fromDegree(finalStates[i], false) > 0) {
                JOptionPane.showMessageDialog(source, "There are transitions from final states.  Please remove them or change " + "\nthe preference in the \"Preferences\" menu in the JFLAP main menu.", "Transitions From Final States", JOptionPane.ERROR_MESSAGE);
                return false;
            }
        }
        return true;
    }

    /**
     * Simulate actions are applicable to all supported automata.
     *
     * @param object
     *            to object to test for applicability
     */
    public static boolean isApplicable(Object object) {
        return object instanceof Automaton;
    }

    /**
     * Returns the automaton.
     *
     * @return the automaton
     */
    protected Object getObject() {
        return automaton;
    }

    /**
     * Returns the environment.
     *
     * @return the environment
     */
    protected Environment getEnvironment() {
        return environment;
    }

    protected void setEnvironment(Environment newEnv) {
        environment = newEnv;
    }

    /**
     * The automaton this simulate action runs simulations on!
     */
    private Automaton automaton;

    /**
     * The environment that the simulation pane will be put in.
     */
    private Environment environment;
}
