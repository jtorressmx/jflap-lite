/*
 * JFLAP - Formal Languages and Automata Package
 * Copyright (c) 2002-2009. All rights reserved.
 * See LICENSE for terms.
 */
package file.xml;

import automata.fsa.FiniteStateAutomaton;
import automata.turing.TuringMachine;
import java.io.Serializable;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

/** Persistence for finite automata and standard single-tape Turing machines. */
public final class TransducerFactory {
    private TransducerFactory() {
    }

    public static Transducer getTransducer(Document document) {
        Element root = document.getDocumentElement();
        NodeList types = root.getElementsByTagName("type");
        if (types.getLength() == 0) throw new IllegalArgumentException("No <type> tag appears to exist!");
        String type = types.item(0).getTextContent().trim();
        if ("fa".equals(type)) return new FSATransducer();
        if ("turing".equals(type)) {
            validateStandardTuring(document);
            return new TMTransducer();
        }
        throw new IllegalArgumentException("Only Finite Automata and standard single-tape Turing Machines are supported.");
    }

    static void validateStandardTuring(Document document) {
        Element root = document.getDocumentElement();
        if (root.getElementsByTagName("block").getLength() != 0
                || root.getElementsByTagName("tag").getLength() != 0) {
            throw new IllegalArgumentException("Turing machines with building blocks are not supported.");
        }
        NodeList tapes = root.getElementsByTagName("tapes");
        if (tapes.getLength() > 1 || (tapes.getLength() == 1
                && !"1".equals(tapes.item(0).getTextContent().trim()))) {
            throw new IllegalArgumentException("Only single-tape Turing machines are supported.");
        }
        NodeList transitions = root.getElementsByTagName("transition");
        for (int index = 0; index < transitions.getLength(); index++) {
            Element transition = (Element) transitions.item(index);
            if (transition.hasAttribute("block")) {
                throw new IllegalArgumentException("Turing block transitions are not supported.");
            }
            for (String tag : new String[]{"read", "write", "move"}) {
                NodeList values = transition.getElementsByTagName(tag);
                if (values.getLength() > 1) {
                    throw new IllegalArgumentException("Only one " + tag + " value is allowed for a single tape.");
                }
                if (values.getLength() == 1) {
                    Element value = (Element) values.item(0);
                    if (value.hasAttribute("tape") && !"1".equals(value.getAttribute("tape"))) {
                        throw new IllegalArgumentException("Only tape 1 is supported.");
                    }
                }
            }
        }
    }

    public static Transducer getTransducer(Serializable machine) {
        if (machine instanceof FiniteStateAutomaton) return new FSATransducer();
        if (machine instanceof TuringMachine) return new TMTransducer();
        throw new IllegalArgumentException("Only Finite Automata and standard single-tape Turing Machines are supported.");
    }
}
