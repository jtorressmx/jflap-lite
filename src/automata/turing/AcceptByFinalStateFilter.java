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
//MERLIN MERLIN MERLIN MERLIN MERLIN//
/**
 * Let the TMConfigurations be passed to me, and I will decide to accept, reject, or perform some other miracle.
 */
package automata.turing;

import java.util.Arrays;

public class //note that building blocks should be STRIPPED of FINAL states //or we could simply ignore final states in nonTopLevel.
AcceptByFinalStateFilter implements //note that building blocks should be STRIPPED of FINAL states //or we could simply ignore final states in nonTopLevel.
AcceptanceFilter {

    public boolean accept(TMConfiguration tmc) {
        TMState tms = (TMState) tmc.getCurrentState();
        //first, we check if this is a top-level state, if it is not, we cannot accept
        if (((TuringMachine) tms.getAutomaton()).getParent() != null)
            return false;
        return Arrays.asList(tms.getAutomaton().getFinalStates()).contains(tms);
    }

    public String getName() {
        return "Accept by Final State";
    }
}
