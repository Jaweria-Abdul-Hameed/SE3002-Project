package se3002.team.pit.fixture;

import com.grash.model.Request;
import com.grash.model.Role;
import com.grash.model.WorkOrder;
import com.grash.model.enums.RoleCode;

/**
 * Reproduces the code shapes of the rules in Atlas's RequestService
 * (baseline a3c7ce38), so the mutators can be tested without building Atlas.
 */
public class RequestRulesFixture {

    /** Same expression as RequestService.approve / cancel (lines 376 and 458). */
    public boolean canReview(Role role) {
        return role.getViewPermissions().contains("SETTINGS") || role.getCode().equals(RoleCode.LIMITED_ADMIN);
    }

    /** Same guard as RequestService.approveInternal (compiles to IFNULL). */
    public WorkOrder approve(Request request) {
        if (request.getWorkOrder() != null) {
            throw new IllegalStateException("Request is already approved");
        }
        WorkOrder workOrder = new WorkOrder();
        request.setWorkOrder(workOrder);
        return workOrder;
    }

    /** The "== null" form of the same check (compiles to IFNONNULL). */
    public boolean isPending(Request request) {
        return request.getWorkOrder() == null;
    }

    /** getWorkOrder() not used in a null check: must NOT be mutated. */
    public WorkOrder linkedWorkOrder(Request request) {
        return request.getWorkOrder();
    }
}
