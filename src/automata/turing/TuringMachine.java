/*
 * JFLAP - Formal Languages and Automata Package
 * Copyright (c) 2002-2009. All rights reserved.
 * See LICENSE for terms.
 */
package automata.turing;

import automata.Automaton;
import automata.Transition;

/** A standard Turing machine with exactly one tape and ordinary states. */
public class TuringMachine extends Automaton {
    private static final long serialVersionUID = 1L;

    public TuringMachine() {
        super();
    }

    public TuringMachine(int tapes) {
        this();
        if (tapes != 1) {
            throw new IllegalArgumentException("Only single-tape Turing machines are supported.");
        }
    }

    protected Class getTransitionClass() {
        return TMTransition.class;
    }

    public void addTransition(Transition transition) {
        if (!(transition instanceof TMTransition) || ((TMTransition) transition).tapes() != 1) {
            throw new IllegalArgumentException("A Turing transition must use exactly one tape.");
        }
        super.addTransition(transition);
    }

    public int tapes() {
        return 1;
    }
}
