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
package gui.editor;

import gui.environment.Universe;
import java.util.Deque;
import java.util.LinkedList;
import automata.Automaton;

/**
 * This class will store the states between actions, that we may undo them.
 * Since there should be one set of states per active window, this class should be instantiated
 * within the AutomatonFrame class.
 *
 * Let's use it statically for now (testing / prototype), so we don't have to change environment frame to instantiate it.
 * @author Henry Qin
 */
public class UndoKeeper {

    private Automaton myMaster;

    private Deque<Automaton> myDeck;

    private Deque<Automaton> myBackDeck;

    private int numUndo;

    public UndoKeeper(Automaton master) {
        myMaster = master;
        myDeck = new LinkedList<Automaton>();
        myBackDeck = new LinkedList<Automaton>();
        numUndo = Universe.curProfile.undo_num;
    }

    public void setNumUndo(int nn) {
        numUndo = nn;
    }

    public boolean sensitive = false;

    private boolean wait = false;

    public void setWait() {
        wait = true;
    }

    public void saveStatus() {
        if (wait) {
            wait = false;
            return;
        }
        //        if (myDeck.size() > 0)
        //push on head
        myDeck.push((Automaton) myMaster.clone());
        System.out.println();
        if (myDeck.size() >= 2) {
            Automaton first = myDeck.pop();
            Automaton second = myDeck.pop();
            if (first.hashCode() == second.hashCode()) {
                myDeck.push(first);
            } else {
                myDeck.push(second);
                myDeck.push(first);
                myBackDeck.clear();
            }
        }
        while (myDeck.size() > numUndo) myDeck.removeLast();
    }

    /*Undo*/
    public void restoreStatus() {
        if (myDeck.size() == 0)
            return;
        Automaton p = null;
        while (myDeck.size() > 0 && (p = myDeck.pop()).hashCode() == myMaster.hashCode()) ;
        if (myDeck.size() == 0 && p.hashCode() == myMaster.hashCode())
            return;
        sensitive = true;
        myBackDeck.push((Automaton) myMaster.clone());
        Automaton.become(myMaster, p);
        sensitive = false;
        myMaster.getEnvironmentFrame().repaint();
    }

    public void redo() {
        if (myBackDeck.size() == 0)
            return;
        //push on head
        myDeck.push((Automaton) myMaster.clone());
        Automaton.become(myMaster, myBackDeck.pop());
        myMaster.getEnvironmentFrame().repaint();
    }
}
