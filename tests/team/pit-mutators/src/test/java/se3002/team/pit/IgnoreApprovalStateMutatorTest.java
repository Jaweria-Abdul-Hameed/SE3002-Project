package se3002.team.pit;

import com.grash.model.Request;
import com.grash.model.WorkOrder;
import org.junit.jupiter.api.Test;
import org.pitest.mutationtest.engine.MutationDetails;
import se3002.team.pit.fixture.RequestRulesFixture;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class IgnoreApprovalStateMutatorTest {

    private final MutantHarness harness = new MutantHarness(new IgnoreApprovalStateMutator(), RequestRulesFixture.class);

    private static Request approvedRequest() {
        Request request = new Request();
        request.setWorkOrder(new WorkOrder());
        return request;
    }

    @Test
    void mutatesBothNullCheckFormsButNotAPlainGetterCall() {
        List<String> methods = harness.mutations().stream().map(MutationDetails::getMethod).sorted().toList();
        assertEquals(List.of("approve", "isPending"), methods);
        assertTrue(harness.onlyMutationIn("approve").getDescription().startsWith(IgnoreApprovalStateMutator.NAME));
    }

    @Test
    void originalRejectsApprovingTwice() {
        assertThrows(IllegalStateException.class, () -> new RequestRulesFixture().approve(approvedRequest()));
    }

    @Test
    void mutantAllowsApprovingAnAlreadyApprovedRequest() throws Exception {
        Object mutant = harness.mutantInstance(harness.onlyMutationIn("approve"));
        Method approve = mutant.getClass().getMethod("approve", Request.class);
        Request request = approvedRequest();
        WorkOrder first = request.getWorkOrder();

        Object second = invoke(approve, mutant, request);

        assertNotNull(second);
        assertNotSame(first, second, "mutant should create a duplicate work order");
    }

    @Test
    void mutantReportsAnApprovedRequestAsPending() throws Exception {
        Object mutant = harness.mutantInstance(harness.onlyMutationIn("isPending"));
        Method isPending = mutant.getClass().getMethod("isPending", Request.class);

        assertTrue((boolean) invoke(isPending, mutant, approvedRequest()));
    }

    private static Object invoke(Method method, Object target, Object arg) throws Exception {
        try {
            return method.invoke(target, arg);
        } catch (InvocationTargetException e) {
            throw new AssertionError("mutant threw " + e.getCause(), e.getCause());
        }
    }
}
