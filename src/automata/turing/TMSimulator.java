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
package automata.turing;

import java.util.List;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.Arrays;
import automata.Automaton;
import automata.AutomatonSimulator;
import automata.Configuration;
import automata.Transition;
import gui.environment.Universe;
import javax.swing.JOptionPane;

public class TMSimulator extends AutomatonSimulator {

    /**
     * Creates a TM simulator for the given automaton.
     *
     * @param automaton
     *            the machine to simulate
     * @throws IllegalArgumentException
     *             if this automaton is not a Turing machine
     */
    public TMSimulator(Automaton automaton) {
        super(automaton);
        if (!(automaton instanceof TuringMachine))
            throw new IllegalArgumentException("Automaton is not a Turing machine, but a " + automaton.getClass());
        //       //MERLIN MERLIN MERLIN MERLIN MERLIN// //this code is only for show, it should be moved into a setting with a better UI before release//
        //        if (tlist.size() == 0)
        //       //END MERLIN MERLIN MERLIN MERLIN MERLIN// //this code is only for show, it should be moved into a setting with a better UI before release//
        List<AcceptanceFilter> tlist = new ArrayList<AcceptanceFilter>();
        if (Universe.curProfile.getAcceptByFinalState())
            tlist.add(new AcceptByFinalStateFilter());
        if (Universe.curProfile.getAcceptByHalting())
            tlist.add(new AcceptByHaltingFilter());
        myFilters = tlist.toArray(new AcceptanceFilter[0]);
    }

    /**
     * Returns a TMConfiguration object that represents the initial
     * configuration of the TM, before any input has been processed. This
     * returns an array of length one. This method exists only to provide
     * compatibility with the general definition of <CODE>AutomatonSimulator</CODE>.
     * One should use the version of this function that accepts an array of
     * inputs instead.
     *
     * @param input
     *            the input string
     */
    public Configuration[] getInitialConfigurations(String input) {
        if (input == null)
            throw new IllegalArgumentException("Input is required.");
        return getInitialConfigurations(new String[] { input });
    }

    /**
     * Returns a TMConfiguration object that represents the initial
     * configuration of the TM, before any input has been processed. This
     * returns an array of length one.
     *
     * @param inputs
     *            the input strings
     */
    public Configuration[] getInitialConfigurations(String[] inputs) {
        if (inputs.length != 1)
            throw new IllegalArgumentException("Only one input tape is supported.");
        inputStrings = inputs.clone();
        varToChar.clear();
        return new Configuration[] { new TMConfiguration(myAutomaton.getInitialState(), null, new Tape[] { new Tape(inputs[0]) }, myFilters) };
    }

    /**
     * A vision and a dream, that another take this responsibility.
     *
     * This method figures out whether a particular transition is matched by a particular array of tapes.
     */
    private boolean matches(Tape[] tapes, TMTransition tmt) {
        //make sure they address the same number of tapes
        assert tapes.length == tmt.tapes();
        assert tapes.length == 1;
        char underHead = tapes[0].readChar();
        String strtoMatch = tmt.getRead(0);
        int assignIndex = strtoMatch.indexOf('}');
        int bangIndex = strtoMatch.indexOf('!');
        //MERLIN MERLIN MERLIN MERLIN MERLIN//
        //this should have been taken care of during the editing phase - probably put in a re-check on load from save, for legacy issues
        //both cannot coexist
        assert assignIndex == -1 || bangIndex == -1;
        if (assignIndex == -1 && bangIndex == -1) {
            //ordinary case
            return underHead == strtoMatch.charAt(0) || strtoMatch.charAt(0) == '~';
            //watch out for recognizing a variable
        } else if (assignIndex != -1) {
            String[] characters = strtoMatch.substring(0, assignIndex).split(",");
            //this would not be needed, but we want to go through and do error checking on the transition as well
            boolean flag = false;
            for (int i = 0; i < characters.length; i++) {
                assert characters[i].length() == 1;
                if (varToChar.containsKey(characters[i])) {
                    //warn the user that they are attempting something erroneous
                    //MERLIN MERLIN MERLIN MERLIN MERLIN//
                    JOptionPane.showMessageDialog(null, "You cannot use a variable on the left side of the assignment operator!\n Please fix this and restart the simulation.", "Illegal Variable Location!\n", JOptionPane.ERROR_MESSAGE);
                }
                //take care of assignment somewhere else //here, it's only alphabet letters
                if (characters[i].charAt(0) == underHead)
                    flag = true;
            }
            return flag;
        } else {
            assert bangIndex == 0;
            return underHead != strtoMatch.charAt(1);
        }
    }

    /**
     * Simulates one step for a particular configuration, adding the
     * next reachable configuration. In other words, this code is for a DETERMINISTIC
     * Turing machine. The ArrayList returned will have list 1.
     * @param config
     *            the configuration to simulate the one step on
     *
     * @return ArrayList containing the single configuration, or null if there are no valid transitions.
     */
    public ArrayList<Configuration> stepConfiguration(Configuration config) {
        TMConfiguration configuration = (TMConfiguration) config;
        ArrayList<Configuration> next = new ArrayList<>();
        Transition[] transitions = myAutomaton.getTransitionsFromState(configuration.getCurrentState());
        Arrays.sort(transitions, (first, second) -> Boolean.compare(((TMTransition) first).getRead(0).startsWith("!"), ((TMTransition) second).getRead(0).startsWith("!")));
        for (Transition transition : transitions) {
            TMTransition match = (TMTransition) transition;
            if (!matches(configuration.getTapes(), match))
                continue;
            Tape tape = new Tape(configuration.getTapes()[0]);
            String read = match.getRead(0);
            int assignment = read.indexOf('}');
            if (assignment != -1) {
                varToChar.put(read.substring(assignment + 1), String.valueOf(tape.readChar()));
            }
            String write = match.getWrite(0);
            if (!"~".equals(write))
                tape.writeChar(varToChar.getOrDefault(write, write).charAt(0));
            tape.moveHead(match.getDirection(0));
            next.add(new TMConfiguration(match.getToState(), configuration, new Tape[] { tape }, myFilters));
            return next;
        }
        if (!configuration.isHalted()) {
            TMConfiguration halted = (TMConfiguration) configuration.clone();
            halted.setHalted(true);
            next.add(halted);
        }
        return next;
    }

    /**
     * Returns true if the simulation of the input string on the automaton left
     * the machine in a final state.
     *
     * @return true if the simulation of the input string on the automaton left
     *         the machine in a final state
     */
    public boolean isAccepted() {
        return myConfigurations.stream().anyMatch(Configuration::isAccept);
    }

    /**
     * Runs the automaton on the input string.
     *
     * @param input
     *            the input string to be run on the automaton
     * @return true if the automaton accepts the input
     */
    public boolean simulateInput(String input) {
        /**
         * clear the configurations to begin new simulation.
         */
        myConfigurations.clear();
        Configuration[] initialConfigs = getInitialConfigurations(input);
        for (int k = 0; k < initialConfigs.length; k++) {
            TMConfiguration initialConfiguration = (TMConfiguration) initialConfigs[k];
            myConfigurations.add(initialConfiguration);
        }
        while (!myConfigurations.isEmpty()) {
            if (isAccepted())
                return true;
            ArrayList<Configuration> configurationsToAdd = new ArrayList<>();
            Iterator<Configuration> it = myConfigurations.iterator();
            while (it.hasNext()) {
                TMConfiguration configuration = (TMConfiguration) it.next();
                ArrayList<Configuration> configsToAdd = stepConfiguration(configuration);
                configurationsToAdd.addAll(configsToAdd);
                it.remove();
            }
            myConfigurations.addAll(configurationsToAdd);
        }
        return false;
    }

    public String[] getInputStrings() {
        return inputStrings;
    }

    private String[] inputStrings;

    private Map<String, String> varToChar = new HashMap<String, String>();

    private AcceptanceFilter[] myFilters;
}
