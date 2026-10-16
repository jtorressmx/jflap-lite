/*
 * JFLAP - Formal Languages and Automata Package
 * Copyright (c) 2002-2009. All rights reserved.
 * See LICENSE for terms.
 */
package file.xml;

import automata.fsa.FiniteStateAutomaton;
import automata.turing.TuringMachine;
import automata.turing.TuringMachineBuildingBlocks;
import gui.action.OpenAction;
import java.io.Serializable;
import javax.swing.JOptionPane;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

/** Selects persistence only for finite automata and Turing machines. */
public final class TransducerFactory {
    private TransducerFactory() {
    }

    public static Transducer getTransducer(Document document) {
        Element root = document.getDocumentElement();
        NodeList types = root.getElementsByTagName("type");
        if (types.getLength() == 0) {
            throw new IllegalArgumentException("No <type> tag appears to exist!");
        }
        String type = types.item(0).getTextContent().trim();
        if ("fa".equals(type)) {
            return new FSATransducer();
        }
        if ("turingbb".equals(type)) {
            return new TMBBTransducer();
        }
        if (!"turing".equals(type)) {
            throw new IllegalArgumentException("Only Finite Automata and Turing Machines are supported.");
        }
        if (root.getElementsByTagName("tapes").getLength() > 0) {
            return new TMTransducer();
        }
        if (root.getElementsByTagName("block").getLength() > 0 || OpenAction.openOrRead) {
            return new TMBBTransducer();
        }
        Object[] options = {"Standard Turing Machine", "Turing Machine with Building Blocks"};
        Object selected = JOptionPane.showInputDialog(null,
                "What type of Turing machine do you wish to open this file as?",
                "Type of Turing machine", JOptionPane.INFORMATION_MESSAGE, null, options, options[0]);
        return selected == options[0] ? new TMTransducer() : new TMBBTransducer();
    }

    public static Transducer getTransducer(Serializable machine) {
        if (machine instanceof FiniteStateAutomaton) {
            return new FSATransducer();
        }
        if (machine instanceof TuringMachineBuildingBlocks) {
            return new TMBBTransducer();
        }
        if (machine instanceof TuringMachine) {
            return new TMTransducer();
        }
        throw new IllegalArgumentException("Only Finite Automata and Turing Machines are supported.");
    }
}
