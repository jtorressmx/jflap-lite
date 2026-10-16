/*
 * JFLAP - Formal Languages and Automata Package
 * Copyright (c) 2002-2009. All rights reserved.
 * See LICENSE for terms.
 */
package file.xml;

import automata.Automaton;
import automata.State;
import automata.Transition;
import automata.turing.TMTransition;
import automata.turing.TuringMachine;
import file.DataException;
import java.util.Map;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

/** XML persistence for standard, single-tape Turing machines. */
public class TMTransducer extends AutomatonTransducer {
    protected Automaton createEmptyAutomaton(Document document) {
        TransducerFactory.validateStandardTuring(document);
        return new TuringMachine();
    }

    protected Transition createTransition(State from, State to, Node node, Map<String, String> fields) {
        try {
            return new TMTransition(from, to, value(node, "read", ""),
                    value(node, "write", ""), value(node, "move", "R"));
        } catch (IllegalArgumentException exception) {
            throw new DataException(exception.getMessage());
        }
    }

    private String value(Node transition, String tag, String fallback) {
        NodeList elements = ((Element) transition).getElementsByTagName(tag);
        if (elements.getLength() == 0) return fallback;
        if (elements.getLength() != 1) {
            throw new DataException("Only one " + tag + " value is allowed for a single tape.");
        }
        Element element = (Element) elements.item(0);
        if (element.hasAttribute("tape") && !"1".equals(element.getAttribute("tape"))) {
            throw new DataException("Only tape 1 is supported.");
        }
        return element.getTextContent();
    }

    protected Element createTransitionElement(Document document, Transition transition) {
        Element element = super.createTransitionElement(document, transition);
        TMTransition turing = (TMTransition) transition;
        String read = turing.getRead(0);
        String write = turing.getWrite(0);
        element.appendChild(createElement(document, "read", null, TMTransition.BLANK.equals(read) ? "" : read));
        element.appendChild(createElement(document, "write", null, TMTransition.BLANK.equals(write) ? "" : write));
        element.appendChild(createElement(document, "move", null, turing.getDirection(0)));
        return element;
    }

    public String getType() {
        return "turing";
    }
}
