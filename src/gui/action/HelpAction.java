/*
 * JFLAP - Formal Languages and Automata Package
 * Copyright (c) 2002-2009. All rights reserved.
 * See LICENSE for terms.
 */
package gui.action;

import java.awt.event.ActionEvent;
import java.awt.event.KeyEvent;
import javax.swing.JOptionPane;
import javax.swing.KeyStroke;

/** Shared help action for the machine selector and editors. */
public class HelpAction extends RestrictedAction {
    private static final long serialVersionUID = 1L;

    public HelpAction() {
        super("Help...", null);
        putValue(ACCELERATOR_KEY, KeyStroke.getKeyStroke(KeyEvent.VK_SLASH, MAIN_MENU_MASK));
    }

    public void actionPerformed(ActionEvent event) {
        JOptionPane.showMessageDialog(null,
                "Create or open a Finite Automaton or a Turing Machine.\n"
                + "Use the editor toolbar to add states and transitions,\n"
                + "then choose an Input action to simulate your machine.\n\n"
                + "Turing Machines support one tape, multiple tapes, and building blocks.\n"
                + "Save and open machines as .jff files.",
                "JFLAP Lite Help", JOptionPane.INFORMATION_MESSAGE);
    }
}
