/* Runs the actual JFLAP 7.1 FA simulators; GUI frontier semantics match ConfigurationController. */
import automata.*;
import automata.fsa.*;
import file.xml.FSATransducer;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.*;
import javax.xml.parsers.DocumentBuilderFactory;

public final class FiniteOracle {
    private static String q(String s) {
        StringBuilder b = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '"' || c == '\\') b.append('\\').append(c);
            else if (c < 32) b.append(String.format("\\u%04x", (int)c));
            else b.append(c);
        }
        return b.append('"').toString();
    }
    private static String snapshot(Configuration c, Set<Configuration> rejected) {
        FSAConfiguration f = (FSAConfiguration)c;
        List<String> trace = new ArrayList<>();
        for (Configuration p = c; p != null; p = p.getParent()) {
            FSAConfiguration t = (FSAConfiguration)p;
            trace.add(0, "[" + q(String.valueOf(t.getCurrentState().getID())) + "," + (t.getInput().length() - t.getUnprocessedInput().length()) + "]");
        }
        return "{\"state\":" + q(String.valueOf(c.getCurrentState().getID()))
            + ",\"offset\":" + (f.getInput().length() - f.getUnprocessedInput().length())
            + ",\"accepted\":" + c.isAccept() + ",\"rejected\":" + rejected.contains(c)
            + ",\"trace\":[" + String.join(",", trace) + "]}";
    }
    public static void main(String[] args) throws Exception {
        FiniteStateAutomaton machine = (FiniteStateAutomaton)new FSATransducer().fromDOM(DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(new File(args[0])));
        if (args[2].equals("dfa") || args[2].equals("minimize")) {
            FiniteStateAutomaton result;
            if (args[2].equals("dfa")) result = new NFAToDFA().convertToDFA(machine);
            else {
                Minimizer minimizer = new Minimizer(); minimizer.initializeMinimizer();
                Automaton prepared = minimizer.getMinimizeableAutomaton(machine);
                result = minimizer.getMinimumDfa(prepared, minimizer.getDistinguishableGroupsTree(prepared));
            }
            List<String> states = new ArrayList<>(), edges = new ArrayList<>();
            for (State s : result.getStates()) states.add("{\"id\":" + q(String.valueOf(s.getID())) + ",\"label\":" + q(s.getLabel() == null ? "" : s.getLabel()) + ",\"initial\":" + (s == result.getInitialState()) + ",\"final\":" + result.isFinalState(s) + "}");
            for (Transition t : result.getTransitions()) edges.add("[" + q(String.valueOf(t.getFromState().getID())) + "," + q(String.valueOf(t.getToState().getID())) + "," + q(((FSATransition)t).getLabel()) + "]");
            System.out.println("{\"states\":[" + String.join(",", states) + "],\"edges\":[" + String.join(",", edges) + "]}"); System.exit(0);
        }
        AutomatonSimulator simulator = args[2].equals("closure") ? new FSAStepWithClosureSimulator(machine) : new FSAStepByStateSimulator(machine);
        String input = new String(Base64.getDecoder().decode(args[1]), StandardCharsets.UTF_8);
        List<Configuration> frontier = new ArrayList<>(Arrays.asList(simulator.getInitialConfigurations(input)));
        Set<Configuration> rejected = Collections.newSetFromMap(new IdentityHashMap<Configuration, Boolean>());
        List<String> layers = new ArrayList<>();
        for (int step = 0; step <= Integer.parseInt(args[3]); step++) {
            List<String> layer = new ArrayList<>();
            for (Configuration c : frontier) layer.add(snapshot(c, rejected));
            layers.add("[" + String.join(",", layer) + "]");
            List<Configuration> next = new ArrayList<>(); boolean normal = false;
            for (Configuration c : frontier) {
                if (rejected.contains(c) || c.isAccept()) continue;
                normal = true;
                List<Configuration> successors = simulator.stepConfiguration(c);
                if (successors.isEmpty()) { rejected.add(c); next.add(c); }
                else for (Configuration child : successors) if (!next.contains(child)) next.add(child);
            }
            if (!normal) break;
            frontier = next;
        }
        System.out.println("[" + String.join(",", layers) + "]");
        System.exit(0);
    }
}
