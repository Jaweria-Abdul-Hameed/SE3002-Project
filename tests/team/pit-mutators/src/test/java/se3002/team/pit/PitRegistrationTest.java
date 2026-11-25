package se3002.team.pit;

import org.junit.jupiter.api.Test;
import org.pitest.mutationtest.engine.gregor.MethodMutatorFactory;
import org.pitest.mutationtest.engine.gregor.config.Mutator;

import java.util.Collection;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

/** Checks PIT finds both operators by the names used in the mutators list of api/pom.xml. */
class PitRegistrationTest {

    @Test
    void pitResolvesDropRoleAlternativeByName() {
        Collection<MethodMutatorFactory> found = Mutator.byName(DropRoleAlternativeMutator.NAME);
        assertEquals(1, found.size());
        assertInstanceOf(DropRoleAlternativeMutator.class, found.iterator().next());
    }

    @Test
    void pitResolvesIgnoreApprovalStateByName() {
        Collection<MethodMutatorFactory> found = Mutator.byName(IgnoreApprovalStateMutator.NAME);
        assertEquals(1, found.size());
        assertInstanceOf(IgnoreApprovalStateMutator.class, found.iterator().next());
    }
}
