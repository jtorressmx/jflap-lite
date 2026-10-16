/*
 * JFLAP - Formal Languages and Automata Package
 * Copyright (c) 2002-2009. All rights reserved.
 * See LICENSE for terms.
 */
package automata.turing;

import automata.State;

public class AcceptByFinalStateFilter implements AcceptanceFilter {
    public boolean accept(TMConfiguration configuration) {
        State state = configuration.getCurrentState();
        return state.getAutomaton().isFinalState(state);
    }

    public String getName() {
        return "Accept by Final State";
    }
}
