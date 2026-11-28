package com.grash.service;

import com.grash.dto.license.LicenseEntitlement;
import com.grash.exception.CustomException;
import com.grash.model.Company;
import com.grash.repository.WorkOrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * BR-3: a company may hold at most 30 incomplete work orders; creating one more is refused with 403.
 *
 * WorkOrderService.checkUsageBasedLimit (WorkOrderService.java:191-200) evaluates
 *     !hasEntitlement(UNLIMITED_ACTIVE_WORK_ORDERS)  &&  hasMoreActiveThan(companyId, 30 - 1)
 * The repository is replaced by a fake that applies the real query's rule (COUNT(active) > threshold) to a
 * chosen number of incomplete work orders, so the boundary arithmetic of the service is tested exactly.
 *
 * UT-BR3-01..03  3-point BVA around the limit: 29 (allowed), 30 (refused), 31 (refused)
 * UT-BR3-04      MC/DC for the "&&": licensed (first operand false) -> allowed even above the limit,
 *                and the repository is not queried (short-circuit)
 */
@ExtendWith(MockitoExtension.class)
class WorkOrderLimitTeamTest {

    @Mock WorkOrderRepository workOrderRepository;
    @Mock LicenseService licenseService;
    @InjectMocks WorkOrderService workOrderService;

    Company company;

    @BeforeEach
    void setUp() {
        company = new Company();
        company.setId(1L);
    }

    void companyHasIncompleteWorkOrders(long count) {
        when(workOrderRepository.hasMoreActiveThan(eq(1L), anyLong()))
                .thenAnswer(i -> count > (Long) i.getArgument(1));
    }

    @ParameterizedTest(name = "UT-BR3 {0} incomplete work orders -> creating one more allowed={1}")
    @CsvSource({
            "29, true",   // UT-BR3-01 just below: the 30th work order may be created
            "30, false",  // UT-BR3-02 at the limit: a 31st is refused
            "31, false"   // UT-BR3-03 just above
    })
    void boundary(long incomplete, boolean allowed) {
        when(licenseService.hasEntitlement(LicenseEntitlement.UNLIMITED_ACTIVE_WORK_ORDERS)).thenReturn(false);
        companyHasIncompleteWorkOrders(incomplete);

        if (allowed) {
            assertThatCode(() -> workOrderService.checkUsageBasedLimit(company)).doesNotThrowAnyException();
        } else {
            assertThatThrownBy(() -> workOrderService.checkUsageBasedLimit(company))
                    .isInstanceOf(CustomException.class)
                    .hasMessageContaining("Free Limit of 30 incomplete work orders reached")
                    .satisfies(e -> assertThat(((CustomException) e).getHttpStatus()).isEqualTo(HttpStatus.FORBIDDEN));
        }
        verify(workOrderRepository).hasMoreActiveThan(1L, 29L);
    }

    @Test
    @DisplayName("UT-BR3-04 licensed company: no limit, repository not consulted (MC/DC, first operand)")
    void licensed() {
        when(licenseService.hasEntitlement(LicenseEntitlement.UNLIMITED_ACTIVE_WORK_ORDERS)).thenReturn(true);

        assertThatCode(() -> workOrderService.checkUsageBasedLimit(company)).doesNotThrowAnyException();
        verifyNoInteractions(workOrderRepository);
    }
}
