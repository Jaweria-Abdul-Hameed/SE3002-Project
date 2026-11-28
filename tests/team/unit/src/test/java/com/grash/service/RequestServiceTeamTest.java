package com.grash.service;

import com.grash.aspect.TenantAspect;
import com.grash.dto.RequestApproveDTO;
import com.grash.dto.RequestPatchDTO;
import com.grash.dto.RequestPostDTO;
import com.grash.dto.workOrder.WorkOrderPostDTO;
import com.grash.exception.CustomException;
import com.grash.factory.MailServiceFactory;
import com.grash.mapper.RequestMapper;
import com.grash.model.*;
import com.grash.model.enums.AssetStatus;
import com.grash.model.enums.PermissionEntity;
import com.grash.model.enums.RoleCode;
import com.grash.model.enums.webhook.WebhookEvent;
import com.grash.model.enums.workflow.WFMainCondition;
import com.grash.repository.RequestRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.MessageSource;
import org.springframework.http.HttpStatus;

import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * SE3002 white-box unit tests for the business rules of the Requests -> Work Orders module.
 *
 * Test IDs (used in docs/section-2-2-traceability.md and docs/section-2-3-unit-tests.md):
 *   UT-BR1-xx  BR-1 decision "SETTINGS || LIMITED_ADMIN" (MCC rows and MC/DC pairs), approve and cancel
 *   UT-CAN-Px  RequestService.cancel basis paths P1..P8 (Section 2.1)
 *   UT-APP-xx  approve / approveInternal paths (BR-2, BR-3 propagation, side effects)
 *   UT-WO-xx   createWorkOrderFromRequest (auto-assign)
 *   UT-PAT-xx  patch (BR-2 edit guard)
 *   UT-GET-xx  getById
 *   UT-CRE-xx  create(RequestPostDTO, User)
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RequestServiceTeamTest {

    @Mock RequestRepository requestRepository;
    @Mock WorkOrderService workOrderService;
    @Mock RequestMapper requestMapper;
    @Mock EntityManager em;
    @Mock CustomSequenceService customSequenceService;
    @Mock LicenseService licenseService;
    @Mock WebhookDispatchService webhookDispatchService;
    @Mock CustomFieldValueService customFieldValueService;
    @Mock UserService userService;
    @Mock NotificationService notificationService;
    @Mock MessageSource messageSource;
    @Mock MailServiceFactory mailServiceFactory;
    @Mock MailService mailService;
    @Mock AssetService assetService;
    @Mock RequestPortalService requestPortalService;
    @Mock TenantAspect tenantAspect;
    @Mock LocationFilterService locationFilterService;
    @Mock WorkflowService workflowService;

    RequestService service;

    Company company;
    User admin;          // A = true,  B = false
    User limitedAdmin;   // A = false, B = true
    User requester;      // A = false, B = false
    User bothAB;         // A = true,  B = true (unit level only: no such role exists in the application)
    Request pending;
    WorkOrder createdWorkOrder;

    static final long REQUEST_ID = 10L;

    @BeforeEach
    void setUp() {
        service = new RequestService(requestRepository, workOrderService, requestMapper, em, customSequenceService,
                licenseService, webhookDispatchService, customFieldValueService, userService, notificationService,
                messageSource, mailServiceFactory, assetService, requestPortalService, tenantAspect,
                locationFilterService);
        service.setWorkflowService(workflowService);

        company = new Company();
        company.setId(1L);

        Set<PermissionEntity> all = EnumSet.allOf(PermissionEntity.class);
        Set<PermissionEntity> allButSettings = EnumSet.complementOf(EnumSet.of(PermissionEntity.SETTINGS));
        admin = user(1L, "Ayesha", role(RoleCode.ADMIN, all, all, all));
        // Same permissions as the built-in Limited Admin role (Helper.java:250-259): no SETTINGS view and
        // no create permission for PEOPLE_AND_TEAMS or REQUESTS.
        limitedAdmin = user(2L, "Bilal", role(RoleCode.LIMITED_ADMIN, allButSettings, all,
                EnumSet.complementOf(EnumSet.of(PermissionEntity.PEOPLE_AND_TEAMS, PermissionEntity.REQUESTS))));
        requester = user(3L, "Sara", role(RoleCode.REQUESTER,
                EnumSet.of(PermissionEntity.REQUESTS, PermissionEntity.CATEGORIES),
                EnumSet.noneOf(PermissionEntity.class),
                EnumSet.of(PermissionEntity.REQUESTS, PermissionEntity.FILES)));
        bothAB = user(4L, "Both", role(RoleCode.LIMITED_ADMIN, all, all, all));

        pending = new Request();
        pending.setId(REQUEST_ID);
        pending.setTitle("Leaking tap in Room 101");
        pending.setCompany(company);
        pending.setCreatedBy(requester.getId());

        createdWorkOrder = new WorkOrder();
        createdWorkOrder.setId(100L);

        when(requestRepository.findById(REQUEST_ID)).thenAnswer(i -> Optional.of(pending));
        when(requestRepository.save(any(Request.class))).thenAnswer(i -> i.getArgument(0));
        when(userService.findById(requester.getId())).thenReturn(Optional.of(requester));
        when(userService.findByCompany(company.getId())).thenReturn(List.of(admin, limitedAdmin, requester));
        when(mailServiceFactory.getMailService()).thenReturn(mailService);
        when(workOrderService.getWorkOrderFromWorkOrderBase(any())).thenAnswer(i -> new WorkOrderPostDTO());
        when(workOrderService.create(any(), any())).thenReturn(createdWorkOrder);
    }

    static Role role(RoleCode code, Set<PermissionEntity> view, Set<PermissionEntity> viewOther,
                     Set<PermissionEntity> create) {
        return Role.builder().code(code)
                .viewPermissions(new HashSet<>(view))
                .viewOtherPermissions(new HashSet<>(viewOther))
                .createPermissions(new HashSet<>(create))
                .editOtherPermissions(new HashSet<>(viewOther))
                .deleteOtherPermissions(new HashSet<>())
                .build();
    }

    User user(long id, String name, Role role) {
        User u = new User();
        u.setId(id);
        u.setFirstName(name);
        u.setLastName("Test");
        u.setEmail(name.toLowerCase() + "@se3002.test");
        u.setRole(role);
        u.setCompany(company);
        u.setEnabled(true);
        return u;
    }

    static HttpStatus statusOf(Throwable t) {
        return ((CustomException) t).getHttpStatus();
    }

    @SuppressWarnings("unchecked")
    void verifyWebhook(Company to, WebhookEvent event, String field, String newStatus) {
        ArgumentCaptor<Map<String, Object>> payload = ArgumentCaptor.forClass(Map.class);
        verify(webhookDispatchService).dispatchWebhook(eq(to), eq(event), payload.capture(), eq(field), any(),
                any(), any(), any(), any(), any());
        assertThat(payload.getValue()).containsKey("requestId");
        if (newStatus != null) assertThat(payload.getValue()).containsEntry("newStatus", newStatus);
    }

    String[] mailRecipients(String template) {
        ArgumentCaptor<String[]> to = ArgumentCaptor.forClass(String[].class);
        verify(mailService).sendMessageUsingThymeleafTemplate(to.capture(), any(), any(), eq(template), any(), any());
        return to.getValue();
    }

    // ---------------------------------------------------------------------------------------------
    @Nested
    @DisplayName("BR-1: approve/reject allowed only if A (SETTINGS view) || B (LIMITED_ADMIN)")
    class DecisionRule {

        // MCC for "A || B" with short-circuit evaluation. Rows: (T,-), (F,T), (F,F) and, at unit level only, (T,T).
        // MC/DC pairs: A -> (T,F) Admin vs (F,F) Requester;  B -> (F,T) Limited Admin vs (F,F) Requester.

        @Test @DisplayName("UT-BR1-01 approve, A=T B=F (Admin): allowed, work order created")
        void approveAdmin() {
            assertThat(service.approve(REQUEST_ID, new RequestApproveDTO(), admin)).isSameAs(createdWorkOrder);
        }

        @Test @DisplayName("UT-BR1-02 approve, A=F B=T (Limited Admin): allowed")
        void approveLimitedAdmin() {
            assertThat(service.approve(REQUEST_ID, new RequestApproveDTO(), limitedAdmin)).isSameAs(createdWorkOrder);
        }

        @Test @DisplayName("UT-BR1-03 approve, A=F B=F (Requester): 403 Forbidden, nothing created")
        void approveRequester() {
            assertThatThrownBy(() -> service.approve(REQUEST_ID, new RequestApproveDTO(), requester))
                    .isInstanceOf(CustomException.class).hasMessage("Forbidden")
                    .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.FORBIDDEN));
            verify(workOrderService, never()).create(any(), any());
            assertThat(pending.getWorkOrder()).isNull();
        }

        @Test @DisplayName("UT-BR1-04 approve, A=T B=T (unit-only role): allowed")
        void approveBoth() {
            assertThat(service.approve(REQUEST_ID, new RequestApproveDTO(), bothAB)).isSameAs(createdWorkOrder);
        }

        @Test @DisplayName("UT-BR1-05 cancel, A=T B=F (Admin): allowed")
        void cancelAdmin() {
            assertThat(service.cancel(REQUEST_ID, "Duplicate", admin).isCancelled()).isTrue();
        }

        @Test @DisplayName("UT-BR1-06 cancel, A=F B=T (Limited Admin): allowed")
        void cancelLimitedAdmin() {
            assertThat(service.cancel(REQUEST_ID, "Duplicate", limitedAdmin).isCancelled()).isTrue();
        }

        @Test @DisplayName("UT-BR1-07 cancel, A=F B=F (Requester): 403 Forbidden, request unchanged")
        void cancelRequester() {
            assertThatThrownBy(() -> service.cancel(REQUEST_ID, "Duplicate", requester))
                    .isInstanceOf(CustomException.class).hasMessage("Forbidden")
                    .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.FORBIDDEN));
            assertThat(pending.isCancelled()).isFalse();
            verify(requestRepository, never()).save(any());
        }

        @Test @DisplayName("UT-BR1-08 cancel, A=T B=T (unit-only role): allowed")
        void cancelBoth() {
            assertThat(service.cancel(REQUEST_ID, "Duplicate", bothAB).isCancelled()).isTrue();
        }
    }

    // ---------------------------------------------------------------------------------------------
    @Nested
    @DisplayName("cancel(): basis paths P1..P8 from the CFG in Section 2.1 (BR-1, BR-2, BR-4)")
    class CancelBasisPaths {

        @Test @DisplayName("UT-CAN-P1 baseline: Admin, pending, valid reason, has creator -> cancelled, requester notified")
        void p1() {
            Request result = service.cancel(REQUEST_ID, "Duplicate of R000001", admin);

            assertThat(result.isCancelled()).isTrue();
            assertThat(result.getCancellationReason()).isEqualTo("Duplicate of R000001");
            assertThat(result.getWorkOrder()).isNull();
            verify(requestRepository).save(pending);
            verify(workflowService).findByMainConditionAndCompany(WFMainCondition.REQUEST_REJECTED, company.getId());
            assertThat(mailRecipients("rejected-request.html"))
                    .containsExactlyInAnyOrder("bilal@se3002.test", "sara@se3002.test");
            verifyWebhook(company, WebhookEvent.WORK_REQUEST_STATUS_CHANGE, "changedRequest", "CANCELLED");
        }

        @Test @DisplayName("UT-CAN-P2 flip D1: Limited Admin (A=F, B=T) -> same outcome as P1")
        void p2() {
            assertThat(service.cancel(REQUEST_ID, "Duplicate", limitedAdmin).isCancelled()).isTrue();
            verify(requestRepository).save(pending);
        }

        @Test @DisplayName("UT-CAN-P3 flip D2: Requester (A=F, B=F) -> 403")
        void p3() {
            assertThatThrownBy(() -> service.cancel(REQUEST_ID, "Duplicate", requester))
                    .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.FORBIDDEN));
        }

        @Test @DisplayName("UT-CAN-P4 flip D3: request does not exist -> 404 Request not found")
        void p4() {
            assertThatThrownBy(() -> service.cancel(999L, "Duplicate", admin))
                    .hasMessage("Request not found")
                    .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.NOT_FOUND));
        }

        @Test @DisplayName("UT-CAN-P5 flip D4: request already approved -> 406, not cancelled (BR-2)")
        void p5() {
            pending.setWorkOrder(createdWorkOrder);
            assertThatThrownBy(() -> service.cancel(REQUEST_ID, "Duplicate", admin))
                    .hasMessage("Request is already approved")
                    .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.NOT_ACCEPTABLE));
            assertThat(pending.isCancelled()).isFalse();
            assertThat(pending.getCancellationReason()).isNull();
        }

        @Test @DisplayName("UT-CAN-P6 flip D5: reason null -> 406 Please give a reason (BR-4)")
        void p6() {
            assertThatThrownBy(() -> service.cancel(REQUEST_ID, null, admin))
                    .hasMessage("Please give a reason")
                    .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.NOT_ACCEPTABLE));
            assertThat(pending.isCancelled()).isFalse();
        }

        @Test @DisplayName("UT-CAN-P7 flip D6: reason blank \"   \" -> 406 Please give a reason (BR-4)")
        void p7() {
            assertThatThrownBy(() -> service.cancel(REQUEST_ID, "   ", admin))
                    .hasMessage("Please give a reason");
            assertThat(pending.isCancelled()).isFalse();
        }

        @Test @DisplayName("UT-CAN-P8 flip D7: request without creator -> cancelled, requester not looked up")
        void p8() {
            pending.setCreatedBy(null);
            assertThat(service.cancel(REQUEST_ID, "Duplicate", admin).isCancelled()).isTrue();
            verify(userService, never()).findById(any());
            assertThat(mailRecipients("rejected-request.html")).containsExactly("bilal@se3002.test");
        }

        @Test @DisplayName("UT-CAN-09 mail list: only enabled Limited Admins with e-mail on, plus the requester")
        void mailFilter() {
            User disabledLa = user(5L, "Disabled", limitedAdmin.getRole());
            disabledLa.setEnabled(false);
            User quietLa = user(6L, "Quiet", limitedAdmin.getRole());
            quietLa.getUserSettings().setEmailNotified(false);
            when(userService.findByCompany(company.getId()))
                    .thenReturn(List.of(admin, limitedAdmin, requester, disabledLa, quietLa));

            service.cancel(REQUEST_ID, "Duplicate", admin);

            assertThat(mailRecipients("rejected-request.html"))
                    .containsExactlyInAnyOrder("bilal@se3002.test", "sara@se3002.test");
        }

        @Test @DisplayName("UT-CAN-11 'request rejected' automation workflows are run for the cancelled request")
        void runsRejectionWorkflows() {
            Workflow wf = mock(Workflow.class);
            when(workflowService.findByMainConditionAndCompany(WFMainCondition.REQUEST_REJECTED, company.getId()))
                    .thenReturn(List.of(wf));
            service.cancel(REQUEST_ID, "Duplicate", admin);
            verify(workflowService).runRequest(wf, pending);
        }

        @Test @DisplayName("UT-CAN-10 in-app notice goes to the other Limited Admins, not to the Limited Admin who decided")
        @SuppressWarnings("unchecked")
        void notifiesOtherLimitedAdminsOnly() {
            User otherLa = user(7L, "Other", limitedAdmin.getRole());
            when(userService.findByCompany(company.getId()))
                    .thenReturn(List.of(admin, limitedAdmin, otherLa, requester));

            service.cancel(REQUEST_ID, "Duplicate", limitedAdmin);

            ArgumentCaptor<List<Notification>> sent = ArgumentCaptor.forClass(List.class);
            verify(notificationService, times(2)).createMultiple(sent.capture(), eq(true), any());
            List<Notification> toLimitedAdmins = sent.getAllValues().get(1);
            assertThat(toLimitedAdmins).extracting(n -> n.getUser().getId()).containsExactly(7L);
        }
    }

    // ---------------------------------------------------------------------------------------------
    @Nested
    @DisplayName("approve() / approveInternal(): BR-2 state guard, BR-3 propagation, side effects")
    class Approve {

        @Test @DisplayName("UT-APP-01 pending request -> OPEN work order linked both ways, request saved")
        void approvesPending() {
            WorkOrder wo = service.approve(REQUEST_ID, new RequestApproveDTO(), admin);

            assertThat(wo).isSameAs(createdWorkOrder);
            assertThat(pending.getWorkOrder()).isSameAs(createdWorkOrder);
            ArgumentCaptor<WorkOrderPostDTO> dto = ArgumentCaptor.forClass(WorkOrderPostDTO.class);
            verify(workOrderService).create(dto.capture(), eq(company));
            assertThat(dto.getValue().getParentRequest()).isSameAs(pending);
            verify(requestRepository).save(pending);
            verify(workflowService).findByMainConditionAndCompany(WFMainCondition.REQUEST_APPROVED, company.getId());
            assertThat(mailRecipients("approved-request.html"))
                    .containsExactlyInAnyOrder("bilal@se3002.test", "sara@se3002.test");
            verifyWebhook(company, WebhookEvent.WORK_REQUEST_STATUS_CHANGE, "changedRequest", "APPROVED");
        }

        @Test @DisplayName("UT-APP-02 already approved -> 406 Request is already approved, no second work order (BR-2)")
        void alreadyApproved() {
            pending.setWorkOrder(createdWorkOrder);
            assertThatThrownBy(() -> service.approve(REQUEST_ID, new RequestApproveDTO(), admin))
                    .hasMessage("Request is already approved")
                    .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.NOT_ACCEPTABLE));
            verify(workOrderService, never()).create(any(), any());
        }

        @Test @DisplayName("UT-APP-03 unknown id -> 404 Request not found")
        void unknownId() {
            assertThatThrownBy(() -> service.approve(999L, new RequestApproveDTO(), admin))
                    .hasMessage("Request not found")
                    .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.NOT_FOUND));
        }

        @Test @DisplayName("UT-APP-04 BR-3: work-order limit reached -> 403 propagates, request stays pending")
        void limitReached() {
            when(workOrderService.create(any(), any())).thenThrow(new CustomException(
                    "You need a license to add a new work order. Free Limit of 30 incomplete work orders reached",
                    HttpStatus.FORBIDDEN));
            assertThatThrownBy(() -> service.approve(REQUEST_ID, new RequestApproveDTO(), admin))
                    .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.FORBIDDEN));
            assertThat(pending.getWorkOrder()).isNull();
            verify(requestRepository, never()).save(any());
        }

        @Test @DisplayName("UT-APP-05 an automation workflow already created the work order -> it is returned, no second one")
        void workflowCreatedWorkOrder() {
            Workflow wf = mock(Workflow.class);
            WorkOrder fromWorkflow = new WorkOrder();
            when(workflowService.findByMainConditionAndCompany(WFMainCondition.REQUEST_APPROVED, company.getId()))
                    .thenReturn(List.of(wf));
            doAnswer(i -> { pending.setWorkOrder(fromWorkflow); return null; })
                    .when(workflowService).runRequest(wf, pending);

            assertThat(service.approve(REQUEST_ID, new RequestApproveDTO(), admin)).isSameAs(fromWorkflow);
            verify(workOrderService, never()).create(any(), any());
        }

        @Test @DisplayName("UT-APP-06 approveFromWorkflow on an approved request returns the existing work order (no error)")
        void fromWorkflowAlreadyApproved() {
            pending.setWorkOrder(createdWorkOrder);
            assertThat(service.approveFromWorkflow(REQUEST_ID, new RequestApproveDTO(), admin)).isSameAs(createdWorkOrder);
            verify(workflowService, never()).findByMainConditionAndCompany(any(), any());
        }

        @Test @DisplayName("UT-APP-07 approveFromWorkflow on a pending request creates the work order without re-running workflows")
        void fromWorkflowPending() {
            assertThat(service.approveFromWorkflow(REQUEST_ID, new RequestApproveDTO(), admin)).isSameAs(createdWorkOrder);
            verify(workflowService, never()).findByMainConditionAndCompany(any(), any());
        }

        @Test @DisplayName("UT-APP-08 asset with new status -> asset status updated and saved")
        void assetStatusUpdated() {
            Asset asset = new Asset();
            asset.setStatus(AssetStatus.OPERATIONAL);
            pending.setAsset(asset);
            RequestApproveDTO dto = new RequestApproveDTO();
            dto.setAssetStatus(AssetStatus.DOWN);

            service.approve(REQUEST_ID, dto, admin);

            assertThat(asset.getStatus()).isEqualTo(AssetStatus.DOWN);
            verify(assetService).save(asset);
        }

        @Test @DisplayName("UT-APP-09 asset but no new status -> asset untouched")
        void assetWithoutStatus() {
            Asset asset = new Asset();
            asset.setStatus(AssetStatus.OPERATIONAL);
            pending.setAsset(asset);

            service.approve(REQUEST_ID, new RequestApproveDTO(), admin);

            assertThat(asset.getStatus()).isEqualTo(AssetStatus.OPERATIONAL);
            verify(assetService, never()).save(any());
        }

        @Test @DisplayName("UT-APP-10 request without creator -> approved, no requester lookup")
        void noCreator() {
            pending.setCreatedBy(null);
            service.approve(REQUEST_ID, new RequestApproveDTO(), admin);
            verify(userService, never()).findById(any());
            assertThat(mailRecipients("approved-request.html")).containsExactly("bilal@se3002.test");
        }

        @Test @DisplayName("UT-APP-11 mail list excludes disabled and e-mail-off Limited Admins; notice skips the deciding Limited Admin")
        @SuppressWarnings("unchecked")
        void approvalRecipients() {
            User disabledLa = user(5L, "Disabled", limitedAdmin.getRole());
            disabledLa.setEnabled(false);
            User quietLa = user(6L, "Quiet", limitedAdmin.getRole());
            quietLa.getUserSettings().setEmailNotified(false);
            when(userService.findByCompany(company.getId()))
                    .thenReturn(List.of(admin, limitedAdmin, requester, disabledLa, quietLa));

            service.approve(REQUEST_ID, new RequestApproveDTO(), limitedAdmin);

            assertThat(mailRecipients("approved-request.html"))
                    .containsExactlyInAnyOrder("bilal@se3002.test", "sara@se3002.test");
            ArgumentCaptor<List<Notification>> sent = ArgumentCaptor.forClass(List.class);
            verify(notificationService, times(2)).createMultiple(sent.capture(), eq(true), any());
            assertThat(sent.getAllValues().get(1)).extracting(n -> n.getUser().getId())
                    .containsExactlyInAnyOrder(5L, 6L);
        }

        @Test @DisplayName("UT-APP-12 cancelled request can still be approved (defect D1: expected 406, baseline 200)")
        void approvesCancelledRequest_documentsD1() {
            pending.setCancelled(true);
            pending.setCancellationReason("Duplicate");
            // Baseline behaviour, recorded so the defect is visible in the suite. Fixed through a pull request in step 2.8.
            assertThat(service.approve(REQUEST_ID, new RequestApproveDTO(), admin)).isSameAs(createdWorkOrder);
        }
    }

    // ---------------------------------------------------------------------------------------------
    @Nested
    @DisplayName("createWorkOrderFromRequest(): auto-assign preference")
    class CreateWorkOrder {

        @Test @DisplayName("UT-WO-01 auto-assign off -> no primary user set")
        void autoAssignOff() {
            service.createWorkOrderFromRequest(pending, admin);
            ArgumentCaptor<WorkOrderPostDTO> dto = ArgumentCaptor.forClass(WorkOrderPostDTO.class);
            verify(workOrderService).create(dto.capture(), eq(company));
            assertThat(dto.getValue().getPrimaryUser()).isNull();
        }

        @Test @DisplayName("UT-WO-02 auto-assign on, no primary user -> the approver becomes primary user")
        void autoAssignOnEmpty() {
            company.getCompanySettings().getGeneralPreferences().setAutoAssignRequests(true);
            service.createWorkOrderFromRequest(pending, admin);
            ArgumentCaptor<WorkOrderPostDTO> dto = ArgumentCaptor.forClass(WorkOrderPostDTO.class);
            verify(workOrderService).create(dto.capture(), eq(company));
            assertThat(dto.getValue().getPrimaryUser()).isSameAs(admin);
        }

        @Test @DisplayName("UT-WO-03 auto-assign on, primary user already set -> kept")
        void autoAssignOnKeeps() {
            company.getCompanySettings().getGeneralPreferences().setAutoAssignRequests(true);
            WorkOrderPostDTO withUser = new WorkOrderPostDTO();
            withUser.setPrimaryUser(limitedAdmin);
            when(workOrderService.getWorkOrderFromWorkOrderBase(any())).thenReturn(withUser);

            service.createWorkOrderFromRequest(pending, admin);

            assertThat(withUser.getPrimaryUser()).isSameAs(limitedAdmin);
        }
    }

    // ---------------------------------------------------------------------------------------------
    @Nested
    @DisplayName("patch(): edit only while pending (BR-2) and only by an allowed user")
    class Patch {

        @BeforeEach
        void editable() {
            when(requestRepository.existsById(REQUEST_ID)).thenReturn(true);
            when(requestMapper.updateRequest(any(), any())).thenAnswer(i -> i.getArgument(0));
            when(requestRepository.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
        }

        @Test @DisplayName("UT-PAT-01 creator edits a pending request -> updated and saved")
        void creatorEdits() {
            Request result = service.patch(REQUEST_ID, new RequestPatchDTO(), requester);
            assertThat(result).isSameAs(pending);
            verify(requestRepository).saveAndFlush(pending);
        }

        @Test @DisplayName("UT-PAT-02 approved request -> 406 Can't patch an approved request (BR-2)")
        void approved() {
            pending.setWorkOrder(createdWorkOrder);
            assertThatThrownBy(() -> service.patch(REQUEST_ID, new RequestPatchDTO(), requester))
                    .hasMessage("Can't patch an approved request")
                    .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.NOT_ACCEPTABLE));
            verify(requestRepository, never()).saveAndFlush(any());
        }

        @Test @DisplayName("UT-PAT-03 another requester -> 403 Forbidden")
        void otherRequester() {
            User other = user(8L, "Umar", requester.getRole());
            assertThatThrownBy(() -> service.patch(REQUEST_ID, new RequestPatchDTO(), other))
                    .hasMessage("Forbidden")
                    .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.FORBIDDEN));
        }

        @Test @DisplayName("UT-PAT-04 unknown id -> 404 Request not found")
        void unknown() {
            assertThatThrownBy(() -> service.patch(999L, new RequestPatchDTO(), requester))
                    .hasMessage("Request not found")
                    .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.NOT_FOUND));
        }
    }

    // ---------------------------------------------------------------------------------------------
    @Nested
    @DisplayName("getById(): requesters see only their own requests")
    class GetById {

        @Test @DisplayName("UT-GET-01 creator -> request returned")
        void creator() {
            assertThat(service.getById(REQUEST_ID, requester)).isSameAs(pending);
        }

        @Test @DisplayName("UT-GET-02 another requester -> 403 Access denied")
        void otherRequester() {
            User other = user(8L, "Umar", requester.getRole());
            assertThatThrownBy(() -> service.getById(REQUEST_ID, other))
                    .hasMessage("Access denied")
                    .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.FORBIDDEN));
        }

        @Test @DisplayName("UT-GET-03 unknown id -> 404 Not found")
        void unknown() {
            assertThatThrownBy(() -> service.getById(999L, admin))
                    .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.NOT_FOUND));
        }
    }

    // ---------------------------------------------------------------------------------------------
    @Nested
    @DisplayName("create(RequestPostDTO, User): only roles with create permission on REQUESTS")
    class Create {

        @Test @DisplayName("UT-CRE-01 requester submits -> stored with sequential id R000007, admins notified")
        void requesterSubmits() {
            RequestPostDTO dto = new RequestPostDTO();
            dto.setTitle("Leaking tap");
            Request mapped = new Request();
            mapped.setTitle("  <b>Leaking</b> tap  ");
            when(requestMapper.fromPostDTO(dto)).thenReturn(mapped);
            when(customSequenceService.getNextRequestSequence(company)).thenReturn(7L);
            when(requestRepository.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));

            Request created = service.create(dto, requester);

            assertThat(created.getCustomId()).isEqualTo("R000007");
            assertThat(created.getTitle()).as("HTML removed and trimmed by the sanitiser").isEqualTo("Leaking tap");
            verify(em).refresh(created);
            verifyWebhook(company, WebhookEvent.NEW_REQUEST, "newRequest", null);
            assertThat(created.isCancelled()).isFalse();
            assertThat(created.getWorkOrder()).isNull();
            verify(workflowService).findByMainConditionAndCompany(WFMainCondition.REQUEST_CREATED, company.getId());
        }

        @Test @DisplayName("UT-CRE-03 custom field values are stored with the request")
        void customFields() {
            RequestPostDTO dto = new RequestPostDTO();
            dto.setTitle("With fields");
            dto.getCustomFields().add(new com.grash.dto.cutomField.CustomFieldValuePostDTO());
            Request mapped = new Request();
            when(requestMapper.fromPostDTO(dto)).thenReturn(mapped);
            when(requestRepository.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));

            service.create(dto, company);

            verify(customFieldValueService).setCustomFields(eq(mapped), any(), eq(dto.getCustomFields()), eq(company),
                    any(), any());
        }

        @Test @DisplayName("UT-CRE-04 voice note without licence -> 403, nothing stored")
        void voiceNoteWithoutLicence() {
            Request r = new Request();
            r.setTitle("Voice");
            r.setAudioDescription(new File());
            when(licenseService.hasEntitlement(com.grash.dto.license.LicenseEntitlement.VOICE_NOTES)).thenReturn(false);

            assertThatThrownBy(() -> service.create(r, company))
                    .hasMessage("You need a license to add voice notes")
                    .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.FORBIDDEN));
            verify(requestRepository, never()).saveAndFlush(any());
        }

        @Test @DisplayName("UT-CRE-05 voice note with licence; plain Request (not a DTO) is stored without mapping")
        void voiceNoteWithLicence() {
            Request r = new Request();
            r.setTitle("Voice");
            r.setAudioDescription(new File());
            when(licenseService.hasEntitlement(com.grash.dto.license.LicenseEntitlement.VOICE_NOTES)).thenReturn(true);
            when(customSequenceService.getNextRequestSequence(company)).thenReturn(12L);
            when(requestRepository.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));

            assertThat(service.create(r, company).getCustomId()).isEqualTo("R000012");
            verify(requestMapper, never()).fromPostDTO(any());
        }

        // The public request portal is out of functional scope (it needs a licence key in the UI). These two tests
        // only keep the shared create() code fully covered so that coverage and mutation numbers are not diluted.
        RequestPortalField field(com.grash.model.enums.PortalFieldType type, Asset asset, Location location) {
            RequestPortalField f = new RequestPortalField();
            f.setType(type);
            f.setAsset(asset);
            f.setLocation(location);
            return f;
        }

        @Test @DisplayName("UT-CRE-06 portal request takes the portal's preset asset and location")
        void portalPresets() {
            Asset asset = new Asset();
            Location location = new Location();
            Company portalCompany = new Company();
            portalCompany.setId(2L);
            RequestPortal portal = new RequestPortal();
            portal.setCompany(portalCompany);
            portal.getFields().addAll(List.of(
                    field(com.grash.model.enums.PortalFieldType.ASSET, null, null),
                    field(com.grash.model.enums.PortalFieldType.CONTACT, null, null),
                    field(com.grash.model.enums.PortalFieldType.ASSET, asset, null),
                    field(com.grash.model.enums.PortalFieldType.LOCATION, null, null),
                    field(com.grash.model.enums.PortalFieldType.LOCATION, null, location)));
            when(customSequenceService.getNextRequestSequence(company)).thenReturn(3L);
            when(requestRepository.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
            Request r = new Request();
            r.setTitle("<i>From portal</i>");

            Request created = service.create(r, company, portal);

            assertThat(created.getCompany()).isSameAs(portalCompany);
            assertThat(created.getTitle()).isEqualTo("From portal");
            verify(em).refresh(created);
            verifyWebhook(company, WebhookEvent.NEW_REQUEST, "newRequest", null);
            assertThat(created.getAsset()).isSameAs(asset);
            assertThat(created.getLocation()).isSameAs(location);
            assertThat(created.getRequestPortal()).isSameAs(portal);
            assertThat(created.getCustomId()).isEqualTo("R000003");
        }

        @Test @DisplayName("UT-CRE-07 portal voice note without licence -> 403; portal without presets leaves asset empty")
        void portalVoiceNoteAndNoPresets() {
            RequestPortal portal = new RequestPortal();
            portal.setCompany(company);
            Request voice = new Request();
            voice.setAudioDescription(new File());
            assertThatThrownBy(() -> service.create(voice, company, portal))
                    .hasMessage("You need a license to add voice notes");

            when(licenseService.hasEntitlement(com.grash.dto.license.LicenseEntitlement.VOICE_NOTES)).thenReturn(true);
            when(requestRepository.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
            Request created = service.create(voice, company, portal);
            assertThat(created.getAsset()).isNull();
            assertThat(created.getLocation()).isNull();
        }

        @Test @DisplayName("UT-CRE-02 Limited Admin (no create permission on REQUESTS) -> 403 Access denied")
        void limitedAdminRefused() {
            RequestPostDTO dto = new RequestPostDTO();
            dto.setTitle("x");
            assertThatThrownBy(() -> service.create(dto, limitedAdmin))
                    .hasMessage("Access denied")
                    .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.FORBIDDEN));
            verify(requestRepository, never()).saveAndFlush(any());
        }
    }
}
