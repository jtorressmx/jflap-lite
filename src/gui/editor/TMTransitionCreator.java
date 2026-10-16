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

import gui.viewer.AutomatonPane;
import java.awt.Component;
import java.awt.event.ActionEvent;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.ActionMap;
import javax.swing.DefaultCellEditor;
import javax.swing.InputMap;
import javax.swing.JComboBox;
import javax.swing.JTable;
import javax.swing.KeyStroke;
import javax.swing.table.AbstractTableModel;
import javax.swing.table.TableColumn;
import javax.swing.table.TableModel;
import automata.State;
import automata.Transition;
import automata.turing.TMTransition;

/**
 * This is the creator of transitions in turing machines.
 *
 * @author Thomas Finley
 */
public class TMTransitionCreator extends TableTransitionCreator {

    /**
     * Instantiates a new <CODE>TMTransitionCreator</CODE>.
     *
     * @param parent
     *            the parent of whatever dialogs/windows get brought up by this
     *            creator
     */
    public TMTransitionCreator(AutomatonPane parent) {
        super(parent);
    }

    /**
     * Initializes a new empty transition.
     *
     * @param from
     *            the from state
     * @param to
     *            to too state
     */
    protected Transition initTransition(State from, State to) {
        return new TMTransition(from, to, "", "", "R");
    }

    /**
     * Given a transition, returns the arrays the editing table model needs.
     *
     * @param transition
     *            the transition to build the arrays for
     * @return the arrays for the editing table model
     */
    private String[][] arraysForTransition(TMTransition transition) {
        String read = transition.getRead(0);
        String write = transition.getWrite(0);
        return new String[][] { { TMTransition.BLANK.equals(read) ? "" : read, TMTransition.BLANK.equals(write) ? "" : write, transition.getDirection(0) } };
    }

    /**
     * Creates a new table model.
     *
     * @param transition
     *            the transition to create the model for
     * @return a table model for the transition
     */
    protected TableModel createModel(Transition transition) {
        final TMTransition t = (TMTransition) transition;
        return new AbstractTableModel() {

            /**
             */
            private static final long serialVersionUID = 1L;

            public Object getValueAt(int row, int column) {
                return s[row][column];
            }

            public void setValueAt(Object o, int r, int c) {
                s[r][c] = (String) o;
            }

            public boolean isCellEditable(int r, int c) {
                return true;
            }

            public int getRowCount() {
                return 1;
            }

            public int getColumnCount() {
                return 3;
            }

            public String getColumnName(int c) {
                return name[c];
            }

            String[][] s = arraysForTransition(t);

            String[] name = { "Read", "Write", "Direction" };
        };
    }

    /**
     * Creates the table.
     */
    protected JTable createTable(Transition transition) {
        JTable table = super.createTable(transition);
        {
            TableColumn directionColumn = table.getColumnModel().getColumn(2);
            directionColumn.setCellEditor(new DefaultCellEditor(BOX) {

                /**
                 */
                private static final long serialVersionUID = 1L;

                public Component getTableCellEditorComponent(JTable table, Object value, boolean isSelected, int row, int column) {
                    final JComboBox<?> c = (JComboBox<?>) super.getTableCellEditorComponent(table, value, isSelected, row, column);
                    InputMap imap = c.getInputMap();
                    ActionMap amap = c.getActionMap();
                    Object o = new Object();
                    amap.put(o, CHANGE_ACTION);
                    for (int i = 0; i < STROKES.length; i++) imap.put(STROKES[i], o);
                    return c;
                }
            });
        }
        return table;
    }

    /**
     * Modifies a transition according to what's in the table.
     */
    public Transition modifyTransition(Transition transition, TableModel model) {
        TMTransition old = (TMTransition) transition;
        try {
            return new TMTransition(old.getFromState(), old.getToState(), (String) model.getValueAt(0, 0), (String) model.getValueAt(0, 1), (String) model.getValueAt(0, 2));
        } catch (IllegalArgumentException error) {
            reportException(error);
            return null;
        }
    }

    public static void setDirs(boolean allowStay) {
        if (allowStay)
            //made this non-static to allow for switching option
            DIRS = new String[] { "R", "S", "L" };
        else {
            //made this non-static to allow for switching option
            DIRS = new String[] { "R", "L" };
        }
        //we shall see ...arrays can't change size though
        STROKES = new KeyStroke[DIRS.length];
        for (int i = 0; i < STROKES.length; i++) STROKES[i] = KeyStroke.getKeyStroke("shift " + DIRS[i]);
        BOX.removeAllItems();
        for (int i = 0; i < DIRS.length; i++) BOX.addItem(DIRS[i]);
    }

    /**
     * The directions.
     */
    //made this non-static to allow for switching option
    private static String[] DIRS = new String[] { "R", "S", "L" };

    /**
     * The direction field combo box.
     */
    private static JComboBox<String> BOX = new JComboBox<>(DIRS);

    /**
     * The array of keystrokes for the direction field.
     */
    private static KeyStroke[] STROKES;

    /**
     * The action for the strokes for the direction field.
     */
    private static final Action CHANGE_ACTION = new AbstractAction() {

        /**
         */
        private static final long serialVersionUID = 1L;

        public void actionPerformed(ActionEvent e) {
            JComboBox<?> box = (JComboBox<?>) e.getSource();
            box.setSelectedItem(e.getActionCommand().toUpperCase());
        }
    };

    static {
        STROKES = new KeyStroke[DIRS.length];
        for (int i = 0; i < STROKES.length; i++) STROKES[i] = KeyStroke.getKeyStroke("shift " + DIRS[i]);
    }
}
