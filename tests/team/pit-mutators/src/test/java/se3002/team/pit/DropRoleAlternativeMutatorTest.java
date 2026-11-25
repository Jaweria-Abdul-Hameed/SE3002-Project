package se3002.team.pit;

import com.grash.model.Role;
import com.grash.model.enums.RoleCode;
import org.junit.jupiter.api.Test;
import org.pitest.mutationtest.engine.MutationDetails;
import se3002.team.pit.fixture.RequestRulesFixture;

import java.lang.reflect.Method;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DropRoleAlternativeMutatorTest {

    private final MutantHarness harness = new MutantHarness(new DropRoleAlternativeMutator(), RequestRulesFixture.class);
    private final Role limitedAdmin = new Role(RoleCode.LIMITED_ADMIN, Set.of());
    private final Role admin = new Role(RoleCode.ADMIN, Set.of("SETTINGS"));
    private final Role requester = new Role(RoleCode.REQUESTER, Set.of("REQUESTS"));

    @Test
    void createsExactlyOneMutantAndOnlyInTheRoleCheck() {
        assertEquals(1, harness.mutations().size());
        MutationDetails details = harness.onlyMutationIn("canReview");
        assertTrue(details.getDescription().startsWith(DropRoleAlternativeMutator.NAME));
    }

    @Test
    void originalLetsLimitedAdminReview() {
        assertTrue(new RequestRulesFixture().canReview(limitedAdmin));
    }

    @Test
    void mutantRefusesLimitedAdminButKeepsTheOtherCondition() throws Exception {
        Object mutant = harness.mutantInstance(harness.onlyMutationIn("canReview"));
        Method canReview = mutant.getClass().getMethod("canReview", Role.class);

        assertFalse((boolean) canReview.invoke(mutant, limitedAdmin), "role alternative should be removed");
        assertTrue((boolean) canReview.invoke(mutant, admin), "SETTINGS condition must be untouched");
        assertFalse((boolean) canReview.invoke(mutant, requester));
    }
}
