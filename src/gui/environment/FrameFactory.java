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
package gui.environment;

import java.io.Serializable;
import java.awt.Dimension;
import automata.Automaton;

/**
 * The <CODE>FrameFactory</CODE> is a factory for creating environment frames.
 *
 * @author Thomas Finley
 */
public class FrameFactory {

    /**
     * This creates an environment frame for a new item.
     *
     * @param object
     *            the object that we are to edit
     * @return the environment frame for this new item, or <CODE>null</CODE>
     *         if an error occurred
     */
    public static EnvironmentFrame createFrame(Serializable object) {
        Environment environment = EnvironmentFactory.getEnvironment(object);
        if (environment == null)
            // No environment could be found.
            return null;
        EnvironmentFrame frame = new EnvironmentFrame(environment);
        if (object instanceof Automaton) {
            ((Automaton) object).setEnvironmentFrame(frame);
        }
        frame.pack();
        // Make sure that the size of the frame is above a certain
        // threshold.
        int width = 600, height = 400;
        width = Math.max(width, frame.getSize().width);
        height = Math.max(height, frame.getSize().height);
        frame.setSize(new Dimension(width, height));
        frame.setVisible(true);
        return frame;
    }

    public static EnvironmentFrame createFrame(Serializable object, boolean multiple) {
        EnvironmentFrame frame = createFrame(object);
        return frame;
    }
}
