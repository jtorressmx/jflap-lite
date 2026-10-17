/* Headless verification harness for the selected, unmodified JFLAP classes.
 * Compile: javac -cp "target/classes;target/lib/*" -d target/oracle docs/verification/TuringOracle.java
 * Run: java -Djava.awt.headless=true -cp "target/oracle;target/classes;target/lib/*" TuringOracle file.jff base64input acceptFinal acceptHalt maxSteps
 * Uses Configuration.isAccept, the actual Fast Run/Multiple Run GUI criterion.
 */
import automata.*;
import automata.turing.*;
import file.xml.TMTransducer;
import gui.environment.Universe;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.*;
import javax.xml.parsers.DocumentBuilderFactory;

public final class TuringOracle {
    private static String quote(String value) {
        StringBuilder result = new StringBuilder("\"");
        for (int i = 0; i < value.length(); i++) {
            char ch = value.charAt(i);
            if (ch == '"' || ch == '\\') result.append('\\').append(ch);
            else if (ch < 32) result.append(String.format("\\u%04x", (int)ch));
            else result.append(ch);
        }
        return result.append('"').toString();
    }
    private static String configuration(TMConfiguration config) {
        Tape tape = config.getTapes()[0];
        String content = tape.getContents();
        int start = 0, end = content.length();
        while (start < end && content.charAt(start) == Tape.BLANK) start++;
        while (end > start && content.charAt(end - 1) == Tape.BLANK) end--;
        List<String> trace = new ArrayList<String>();
        List<String> tapeTrace = new ArrayList<String>();
        Configuration current = config;
        while (current != null) {
            trace.add(0, quote(String.valueOf(current.getCurrentState().getID())));
            tapeTrace.add(0, tapeSnapshot((TMConfiguration)current));
            current = current.getParent();
        }
        boolean allBlank = start == end;
        return "{\"state\":" + quote(String.valueOf(config.getCurrentState().getID()))
            + ",\"contents\":" + quote(content.substring(start, end))
            + ",\"headRelative\":" + (allBlank ? 0 : tape.getTapeHead() - start)
            + ",\"output\":" + quote(tape.getOutput())
            + ",\"halted\":" + config.isHalted()
            + ",\"trace\":[" + String.join(",", trace) + "]"
            + ",\"tapeTrace\":[" + String.join(",", tapeTrace) + "]}";
    }
    private static String tapeSnapshot(TMConfiguration config) {
        Tape tape = config.getTapes()[0];
        String content = tape.getContents();
        int start = 0, end = content.length();
        while (start < end && content.charAt(start) == Tape.BLANK) start++;
        while (end > start && content.charAt(end - 1) == Tape.BLANK) end--;
        return "{\"state\":" + quote(String.valueOf(config.getCurrentState().getID()))
            + ",\"contents\":" + quote(content.substring(start, end))
            + ",\"headRelative\":" + (start == end ? 0 : tape.getTapeHead() - start)
            + ",\"output\":" + quote(tape.getOutput())
            + ",\"halted\":" + config.isHalted() + "}";
    }
    public static void main(String[] args) throws Exception {
        Universe.curProfile.setAcceptByFinalState(Boolean.parseBoolean(args[2]));
        Universe.curProfile.setAcceptByHalting(Boolean.parseBoolean(args[3]));
        TuringMachine machine = (TuringMachine)new TMTransducer().fromDOM(DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(new File(args[0])));
        AutomatonSimulator simulator = SimulatorFactory.getSimulator(machine);
        String input = new String(Base64.getDecoder().decode(args[1]), StandardCharsets.UTF_8);
        List<Configuration> frontier = new ArrayList<Configuration>(Arrays.asList(simulator.getInitialConfigurations(input)));
        Set<Configuration> rejected = new HashSet<Configuration>();
        int steps = 0, maximum = Integer.parseInt(args[4]);
        String status = "limit";
        while (true) {
            boolean accepted = false;
            for (Configuration config : frontier) if (config.isAccept()) accepted = true;
            if (accepted) { status = "accepted"; break; }
            if (frontier.isEmpty() || rejected.containsAll(frontier)) { status = "rejected"; break; }
            if (steps >= maximum || frontier.size() > 2000) break;
            List<Configuration> next = new ArrayList<Configuration>();
            // getValidConfigurations selects NORMAL, then clearThawed removes all old non-FREEZE cards.
            for (Configuration config : frontier) {
                if (rejected.contains(config) || config.isAccept()) continue;
                List<Configuration> successors = simulator.stepConfiguration(config);
                if (successors.isEmpty()) { rejected.add(config); next.add(config); }
                else next.addAll(successors);
            }
            frontier = next;
            steps++;
        }
        List<String> configurations = new ArrayList<String>();
        for (Configuration config : frontier) configurations.add(configuration((TMConfiguration)config));
        System.out.println("{\"mode\":" + quote(simulator instanceof NDTMSimulator ? "nondeterministic" : "deterministic")
            + ",\"status\":" + quote(status) + ",\"steps\":" + steps + ",\"configurations\":[" + String.join(",", configurations) + "]}");
        // Universe initializes Swing's event thread; explicitly end this verification-only process.
        System.exit(0);
    }
}
