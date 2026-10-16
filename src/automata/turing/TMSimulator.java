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
import java.util.Comparator;
import java.util.Arrays;
import automata.Automaton;
import automata.AutomatonSimulator;
import automata.Configuration;
import automata.Transition;
import gui.environment.Universe;
import debug.EDebug;
import javax.swing.JOptionPane;

/**
 * The TM simulator progresses TM configurations on a possibly multitape Turing
 * machine.
 *
 * @author Thomas Finley
 */
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
        int tapes = ((TuringMachine) myAutomaton).tapes();
        String[] inputs = new String[tapes];
        for (int i = 0; i < tapes; i++) inputs[i] = input;
        return getInitialConfigurations(inputs);
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
        inputStrings = (String[]) inputs.clone();
        Tape[] tapes = new Tape[inputs.length];
        for (int i = 0; i < tapes.length; i++) tapes[i] = new Tape(inputs[i]);
        Configuration[] configs = new Configuration[1];
        TMState initialState = (TMState) myAutomaton.getInitialState();
        TuringMachine tm = initialState.getInnerTM();
        configs[0] = new TMConfiguration(initialState, null, tapes, myFilters);
        return configs;
    }

    /**
     * A vision and a dream, that another take this responsibility.
     *
     * This method figures out whether a particular transition is matched by a particular array of tapes.
     */
    private boolean matches(Tape[] tapes, TMTransition tmt) {
        //make sure they address the same number of tapes
        assert tapes.length == tmt.tapes();
        //for MULTITAPE turing Machine
        if (tapes.length > 1) {
            for (int i = 0; i < tapes.length; i++) {
                char underHead = tapes[i].readChar();
                char toMatch = tmt.getRead(i).charAt(0);
                //                    if (underHead == toMatch)
                if (underHead != toMatch && toMatch != '~')
                    return false;
                //would like to get priorities right for each tape, because the ! parameter shoudl not introduce arbitrary nondeterminism unless we want it to
            }
            return true;
        }
        assert tapes.length == 1;
        //fancy features only work on single-tape machines
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
            if (flag)
                return flag;
        } else {
            assert bangIndex == 0;
            return underHead != strtoMatch.charAt(1);
        }
        //should never get down here
        assert false;
        return true;
    }

    /**
     * Simulates stepping by building blocks (top-level building blocks). Again, note that this is deterministic.
     * @param config
     *            the configuration to simulate the one step on
     *
     * @return List containing the single configuration, or null if there are no valid transitions.
     */
    public List<Configuration> stepBlock(TMConfiguration config) {
        EDebug.print("Inside StepBlock");
        while (((TuringMachine) (config = (TMConfiguration) stepConfiguration(config).get(0)).getCurrentState().getAutomaton()).getParent() != null) ;
        return Arrays.asList(config);
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
        //one step, and will dig into building blocks if necessary
        //MERLIN MERLIN MERLIN MERLIN MERLIN//
        ArrayList<Configuration> list = new ArrayList<>();
        TMConfiguration configuration = (TMConfiguration) config;
        TMState currentState = (TMState) configuration.getCurrentState();
        //just a literally tmp, like /tmp
        TuringMachine tmp = null;
        int times = 0;
        while ((tmp = currentState.getInnerTM()).getStates().length != 0) {
            EDebug.print(times++);
            currentState = (TMState) tmp.getInitialState();
            //check that the initial state exists
            if (currentState == null) {
                JOptionPane.showMessageDialog(null, "It appears that one of your building blocks, possibly nested, lacks an initial state.\n " + "Please resolve this problem and restart the simulation.", "Missing Initial State", JOptionPane.ERROR_MESSAGE);
                return list;
            }
        }
        assert (tmp == currentState.getInnerTM());
        assert (tmp.getParent() == currentState);
        Transition[] trans = currentState.getAutomaton().getTransitionsFromState(currentState);
        TMTransition tmt = null;
        boolean success = false;
        outer: while (true) {
            //sort the ones with the ! symbol to be the later ones. If there are multiple !, then the choice is arbitrary.
            Arrays.sort(trans, new Comparator<Transition>() {

                public int compare(Transition a, Transition b) {
                    //variables are only allowed with SINGLE TAPE, and same with NOT
                    TMTransition tma = (TMTransition) a;
                    TMTransition tmb = (TMTransition) b;
                    char fa = tma.getRead(0).charAt(0);
                    char fb = tmb.getRead(0).charAt(0);
                    return (fa == '!') ? (fb == '!' ? 0 : 1) : (fb == '!' ? 1 : 0);
                }
            });
            //go through transitions at current level
            for (int i = 0; i < trans.length; i++) {
                tmt = (TMTransition) trans[i];
                if (matches(configuration.getTapes(), tmt)) {
                    success = true;
                    break outer;
                }
                //tilda means to read nothing or write nothing, and it seems to be explicitly written for turing machines, rather differently from other automata
            }
            //rise a level above.
            if (//if this fails, that means that you forgot to set the parent in the XML encoder
            tmp.getParent() != null) {
                currentState = tmp.getParent();
                tmp = (TuringMachine) currentState.getAutomaton();
                //this line does not matter right now
                trans = tmp.getTransitionsFromState(currentState);
            } else {
                //halting condition
                break;
            }
        }
        if (success) {
            //if variables are used then they will be common to all tapes...
            if (configuration.getTapes().length > 1) {
                for (int k = 0; k < configuration.getTapes().length; k++) {
                    configuration.getTapes()[k].writeChar(tmt.getWrite(k).charAt(0) == '~' ? configuration.getTapes()[k].readChar() : tmt.getWrite(k).charAt(0));
                    configuration.getTapes()[k].moveHead(tmt.getDirection(k));
                    list.add(new TMConfiguration(tmt.getToState(), null, configuration.getTapes(), myFilters));
                }
            } else {
                //only do variable assignments for the one-tape Turing machine...
                //do necessary variable assignments
                String st = tmt.getRead(0);
                int assignIndex = st.indexOf('}');
                if (assignIndex != -1) {
                    String s = "" + st.charAt(assignIndex + 1);
                    varToChar.put(s, configuration.getTapes()[0].readChar() + "");
                }
                //perform the operations on the tape, and return a new TMConfiguration that represents the new position
                configuration.getTapes()[0].writeChar(tmt.getWrite(0).charAt(0) == '~' ? configuration.getTapes()[0].readChar() : (varToChar.containsKey(tmt.getWrite(0).charAt(0) + "") ? varToChar.get(tmt.getWrite(0).charAt(0) + "").charAt(0) : tmt.getWrite(0).charAt(0)));
                configuration.getTapes()[0].moveHead(tmt.getDirection(0));
                //no going back - we are in a deterministic world. If you freeze, then you will not go forward either.
                list.add(new TMConfiguration(tmt.getToState(), null, configuration.getTapes(), myFilters));
            }
        } else {
            //halt - set a flag in a place so that the filter can pick it up later - why not just return a list with a configuration that has a flag which the halt will recognize? But then, when should we return an empty list?
            //well, if we get here again, and the halt flag is set already, then we know that we should return an empty list to know that we rejected.
            //MERLIN MERLIN MERLIN MERLIN MERLIN//
            if (!configuration.isHalted()) {
                //set the halt flag and then add to the list
                configuration.setHalted(true);
                // MIGHT need to use clone instead, but if this works, we'll just go with this.
                list.add(configuration);
            }
        }
        return list;
    }

    /**
     * Returns true if the simulation of the input string on the automaton left
     * the machine in a final state. This method does not appear to be used. It is only left here because the class from which it inherited requires it.
     *
     * @return true if the simulation of the input string on the automaton left
     *         the machine in a final state
     */
    public boolean isAccepted() {
        return false;
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
