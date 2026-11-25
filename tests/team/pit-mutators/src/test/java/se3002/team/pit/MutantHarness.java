package se3002.team.pit;

import org.pitest.classinfo.ClassName;
import org.pitest.classpath.ClassloaderByteArraySource;
import org.pitest.mutationtest.engine.Mutant;
import org.pitest.mutationtest.engine.MutationDetails;
import org.pitest.mutationtest.engine.gregor.GregorMutater;
import org.pitest.mutationtest.engine.gregor.MethodMutatorFactory;

import java.util.List;

/** Runs one mutator through PIT's real mutation engine and loads the resulting mutants. */
final class MutantHarness {

    private final GregorMutater mutater;
    private final Class<?> target;

    MutantHarness(MethodMutatorFactory mutator, Class<?> target) {
        this.mutater = new GregorMutater(ClassloaderByteArraySource.fromContext(), method -> true, List.of(mutator));
        this.target = target;
    }

    List<MutationDetails> mutations() {
        return mutater.findMutations(ClassName.fromClass(target));
    }

    MutationDetails onlyMutationIn(String method) {
        List<MutationDetails> found = mutations().stream().filter(d -> d.getMethod().equals(method)).toList();
        if (found.size() != 1) {
            throw new AssertionError("Expected exactly one mutation in " + method + " but found " + found);
        }
        return found.get(0);
    }

    /** New instance of the mutated target class; every other class comes from the normal class loader. */
    Object mutantInstance(MutationDetails details) throws ReflectiveOperationException {
        Mutant mutant = mutater.getMutation(details.getId());
        Class<?> mutated = new SingleClassLoader(target.getClassLoader(), target.getName(), mutant.getBytes())
                .loadClass(target.getName());
        return mutated.getDeclaredConstructor().newInstance();
    }

    private static final class SingleClassLoader extends ClassLoader {
        private final String name;
        private final byte[] bytes;

        SingleClassLoader(ClassLoader parent, String name, byte[] bytes) {
            super(parent);
            this.name = name;
            this.bytes = bytes;
        }

        @Override
        protected Class<?> loadClass(String className, boolean resolve) throws ClassNotFoundException {
            if (!className.equals(name)) {
                return super.loadClass(className, resolve);
            }
            synchronized (getClassLoadingLock(className)) {
                Class<?> loaded = findLoadedClass(className);
                return loaded != null ? loaded : defineClass(className, bytes, 0, bytes.length);
            }
        }
    }
}
