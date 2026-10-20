/* Uses the original JFLAP JAR's file codec, without the Lite Java classes. */
import automata.Automaton;
import automata.turing.TuringMachine;
import file.XMLCodec;
import java.io.File;
import java.util.Collections;

public final class JffCompatibilityOracle {
    public static void main(String[] args) {
        XMLCodec codec = new XMLCodec();
        Automaton machine = (Automaton) codec.decode(new File(args[0]), Collections.emptyMap());
        if (args.length > 1) {
            codec.encode(machine, new File(args[1]), Collections.emptyMap());
        }
        System.out.println("{\"kind\":\"" + (machine instanceof TuringMachine ? "turing" : "fa")
                + "\",\"states\":" + machine.getStates().length
                + ",\"transitions\":" + machine.getTransitions().length + "}");
    }
}
