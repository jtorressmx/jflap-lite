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
package gui.sim;

import gui.viewer.SelectionDrawer;
import java.awt.Component;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import javax.swing.JOptionPane;
import javax.swing.JSplitPane;
import automata.AutomatonSimulator;
import automata.Configuration;
import automata.turing.TMSimulator;

/**
 * This is an intermediary object between the simulator GUI and the automaton
 * simulators.
 *
 * @author Thomas Finley
 */
public class ConfigurationController implements ConfigurationSelectionListener {

    /**
     * Instantiates a new configuration controller.
     *
     * @param pane
     *            the pane from which we retrieve configurations
     * @param simulator
     *            the automaton simulator
     * @param drawer
     *            the drawer of the automaton
     * @param component
     *            the component in which the automaton is displayed
     */
    public ConfigurationController(ConfigurationPane pane, AutomatonSimulator simulator, SelectionDrawer drawer, Component component) {
        this.configurations = pane;
        this.simulator = simulator;
        this.drawer = drawer;
        this.component = component;
        changeSelection();
        this.configurations.addSelectionListener(this);
        this.originalConfigurations = (Configuration[]) configurations.getConfigurations();
    }

    /**
     * This sets the configuration pane to have the initial configuration for
     * this input.
     */
    public void reset() {
        configurations.clear();
        if (simulator instanceof TMSimulator) {
            TMSimulator tmSim = (TMSimulator) simulator;
            Configuration[] configs = tmSim.getInitialConfigurations(tmSim.getInputStrings());
            for (int i = 0; i < configs.length; i++) {
                configurations.add(configs[i]);
            }
        } else {
            for (int i = 0; i < originalConfigurations.length; i++) {
                configurations.add(originalConfigurations[i]);
            }
        }
        // What the devil do I have to do to get it to repaint?
        configurations.validate();
        configurations.repaint();
        // Change them darned selections.
        changeSelection();
    }

    /**
     * This method should be called when the simulator pane that this
     * configuration controller belongs to is removed from the environment. This
     * will remove all of the open configuration trace windows.
     */
    public void cleanup() {
        Collection<TraceWindow> windows = configurationToTraceWindow.values();
        Iterator<TraceWindow> it = windows.iterator();
        while (it.hasNext()) ((TraceWindow) it.next()).dispose();
        configurationToTraceWindow.clear();
    }

    public void step() {
        Configuration[] configs = configurations.getValidConfigurations();
        ArrayList<Configuration> list = new ArrayList<>();
        HashSet<Configuration> reject = new HashSet<>();
        // Clear out old states.
        configurations.clearThawed();
        {
            //for ordinary automaton
            for (int i = 0; i < configs.length; i++) {
                ArrayList<Configuration> next = simulator.stepConfiguration(configs[i]);
                //MERLIN MERLIN MERLIN MERLIN MERLIN//
                if (next.size() == 0) {
                    //crucial check for rejection
                    reject.add(configs[i]);
                    list.add(configs[i]);
                } else
                    list.addAll(next);
            }
        }
        // Replace them with the successors.
        Iterator<Configuration> it = list.iterator();
        while (it.hasNext()) {
            Configuration config = (Configuration) it.next();
            configurations.add(config);
            if (reject.contains(config))
                configurations.setReject(config);
        }
        // What the devil do I have to do to get it to repaint?
        configurations.validate();
        configurations.repaint();
        // Change them darned selections.
        changeSelection();
        // Ready for the ugliest code in the whole world, ever?
        try {
            // I take this action without the knowledge or sanction of
            // my government...
            JSplitPane split = (JSplitPane) configurations.getParent().getParent().getParent().getParent();
            int loc = split.getDividerLocation();
            split.setDividerLocation(loc - 1);
            split.setDividerLocation(loc);
            // Yes! GridLayout doesn't display properly in a scroll
            // pane, but if the user "wiggled" the size a little it
            // displays correctly -- now the size is wiggled in code!
        } catch (Throwable e) {
        }
        ////                              case JOptionPane.CANCEL_OPTION:
        ////                              case JOptionPane.NO_OPTION:
        ////                              default:
    }

    /**
     * Freezes selected configurations.
     */
    public void freeze() {
        Configuration[] configs = configurations.getSelected();
        if (configs.length == 0) {
            JOptionPane.showMessageDialog(configurations, NO_CONFIGURATION_ERROR, NO_CONFIGURATION_ERROR_TITLE, JOptionPane.ERROR_MESSAGE);
            return;
        }
        for (int i = 0; i < configs.length; i++) {
            configurations.setFrozen(configs[i]);
        }
        configurations.deselectAll();
        configurations.repaint();
    }

    /**
     * Removes the selected configurations.
     */
    public void remove() {
        Configuration[] configs = configurations.getSelected();
        if (configs.length == 0) {
            JOptionPane.showMessageDialog(configurations, NO_CONFIGURATION_ERROR, NO_CONFIGURATION_ERROR_TITLE, JOptionPane.ERROR_MESSAGE);
            return;
        }
        for (int i = 0; i < configs.length; i++) {
            configurations.remove(configs[i]);
        }
        configurations.validate();
        configurations.repaint();
    }

    /**
     * Sets the drawer to draw the selected configurations' states as selected,
     * or to draw all configurations' states as selected in the event that there
     * are no selected configurations. In this case, the selection refers to the
     * selection of states within the automata, though
     */
    public void changeSelection() {
        drawer.clearSelected();
        for (Configuration configuration : configurations.getConfigurations()) drawer.addSelected(configuration.getCurrentState());
        component.repaint();
    }

    /**
     * Thaws the selected configurations.
     */
    public void thaw() {
        Configuration[] configs = configurations.getSelected();
        if (configs.length == 0) {
            JOptionPane.showMessageDialog(configurations, NO_CONFIGURATION_ERROR, NO_CONFIGURATION_ERROR_TITLE, JOptionPane.ERROR_MESSAGE);
            return;
        }
        for (int i = 0; i < configs.length; i++) {
            configurations.setNormal(configs[i]);
        }
        configurations.deselectAll();
        configurations.repaint();
    }

    /**
     * Given the selected configurations, shows their "trace."
     */
    public void trace() {
        Configuration[] configs = configurations.getSelected();
        if (configs.length == 0) {
            JOptionPane.showMessageDialog(configurations, NO_CONFIGURATION_ERROR, NO_CONFIGURATION_ERROR_TITLE, JOptionPane.ERROR_MESSAGE);
            return;
        }
        for (int i = 0; i < configs.length; i++) {
            TraceWindow window = (TraceWindow) configurationToTraceWindow.get(configs[i]);
            if (window == null) {
                configurationToTraceWindow.put(configs[i], new TraceWindow(configs[i]));
            } else {
                window.setVisible(true);
                window.toFront();
            }
        }
    }

    /**
     * Listens for configuration selection events.
     *
     * @param event
     *            the selection event
     */
    public void configurationSelectionChange(ConfigurationSelectionEvent event) {
    }

    /**
     * This is the pane holding the configurations.
     */
    private ConfigurationPane configurations;

    /**
     * This is the simulator that we step through configurations with.
     */
    private AutomatonSimulator simulator;

    /**
     * This is the selection drawer that draws the automaton.
     */
    private SelectionDrawer drawer;

    /**
     * This is the pane in which the automaton is displayed.
     */
    private Component component;

    /**
     * The mapping of a particular configuration to a trace window. If there is
     * no trace window for that configuration, then that trace window no longer
     * exists.
     */
    private HashMap<Configuration, TraceWindow> configurationToTraceWindow = new HashMap<>();

    /**
     * This is the set of original configurations when the configuration pane
     * started.
     */
    private Configuration[] originalConfigurations = new Configuration[0];

    /**
     * The error message displayed when there is no config selected.
     */
    private static final String NO_CONFIGURATION_ERROR = "Select at least one configuration!";

    /**
     * The error message displayed when there is no config selected.
     */
    private static final String NO_CONFIGURATION_ERROR_TITLE = "No Configuration Selected";
}
