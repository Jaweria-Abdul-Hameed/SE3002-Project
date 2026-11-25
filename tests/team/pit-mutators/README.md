# Custom PIT mutation operators (Atlas CMMS business rules)

This module adds two mutation operators to **PIT 1.30.2**, based on business rules in
`api/src/main/java/com/grash/service/RequestService.java` at baseline commit
`a3c7ce38adedeb90ac13c280e8ccad6622ff2a42`. PIT's built-in mutators only change single
operators, such as `<` to `<=` or `==` to `!=`. These two remove a whole business-rule decision.

| PIT name | Business rule | Code in `RequestService` | Bytecode change |
|---|---|---|---|
| `DROP_ROLE_ALTERNATIVE` | **Decision (2 conditions):** a user may approve or cancel a request if their role has the SETTINGS permission **or** is Limited Admin | `approve` (l. 376), `cancel` (l. 458); also the Limited Admin filters for notification recipients in `approveInternal` | `INVOKEVIRTUAL RoleCode.equals(Object)Z` becomes `POP2; ICONST_0`, i.e. the role check is always `false` |
| `IGNORE_APPROVAL_STATE` | **State transition:** once approved (work order linked), a request cannot be approved again, cancelled or edited | `patch` (l. 365), `approveInternal` (l. 391, plus the post-workflow check), `cancel` (l. 463) | `getWorkOrder()` followed by `IFNULL L` becomes `POP; GOTO L`; followed by `IFNONNULL L` it becomes `POP`. The request is treated as still pending |

Each matching instruction produces a separate mutant. PIT reports them in the same score and
HTML report as its built-in mutators, so they count towards the CI mutation threshold.

**What kills them:**
- `DROP_ROLE_ALTERNATIVE`: a test where a **Limited Admin** approves or cancels a request and
  the test asserts success. An Admin-only test can't kill it, because Admin passes through the
  SETTINGS condition.
- `IGNORE_APPROVAL_STATE`: tests that approve an already-approved request, cancel an approved
  request, or patch an approved request, and assert the "already approved" or "Can't patch"
  rejection. They should also read back that no second work order was created.

**Expected survivors to analyse:**
- The post-workflow `getWorkOrder() != null` check in `approveInternal` only matters when a
  workflow approves the request itself. It is a likely equivalent-mutant candidate unless a
  test sets up such a workflow.
- The Limited Admin filters for notification recipients survive unless a test checks who gets notified.

## Build and test

Requires JDK 17 and Maven 3.9+. You can also use Docker: `maven:3.9-eclipse-temurin-17`.

```bash
mvn -f tests/team/pit-mutators/pom.xml install
```

`install` runs this module's own tests and puts the jar in the local Maven repository, where
`api/pom.xml` can find it. The tests are:

- `PitRegistrationTest`: PIT resolves both operators by name.
- `DropRoleAlternativeMutatorTest` and `IgnoreApprovalStateMutatorTest`: run each operator
  through PIT's real mutation engine (`GregorMutater`) on `fixture/RequestRulesFixture`. That
  fixture copies the code shapes of the `RequestService` rules. The tests check where mutants
  are created and that each mutant really changes behaviour (for example, a mutant
  `approve` lets an approved request be approved again).

## Wiring into `api/pom.xml`

The jar must be declared **twice**. PIT's main process loads mutators from the plugin's own
dependencies. The worker JVM ("minion") that runs the tests against each mutant only sees the
project's test classpath. If the test-scoped dependency is missing, every custom mutant
ends as `RUN_ERROR` with "Mutator or group DROP_ROLE_ALTERNATIVE is unknown".

```xml
<!-- in <dependencies> -->
<dependency>
    <groupId>se3002.team</groupId>
    <artifactId>atlas-pit-mutators</artifactId>
    <version>1.0.0</version>
    <scope>test</scope>
</dependency>

<!-- in <build><plugins> -->
<plugin>
    <groupId>org.pitest</groupId>
    <artifactId>pitest-maven</artifactId>
    <version>1.30.2</version>
    <dependencies>
        <dependency>
            <groupId>org.pitest</groupId>
            <artifactId>pitest-junit5-plugin</artifactId>
            <version>1.2.3</version>
        </dependency>
        <dependency>
            <groupId>se3002.team</groupId>
            <artifactId>atlas-pit-mutators</artifactId>
            <version>1.0.0</version>
        </dependency>
    </dependencies>
    <configuration>
        <targetClasses>
            <param>com.grash.service.RequestService</param>
        </targetClasses>
        <targetTests>
            <param>se3002.team.*</param>   <!-- our tests only; upstream tests earn no marks -->
        </targetTests>
        <mutators>
            <mutator>DEFAULTS</mutator>
            <mutator>DROP_ROLE_ALTERNATIVE</mutator>
            <mutator>IGNORE_APPROVAL_STATE</mutator>
        </mutators>
        <mutationThreshold>__JUSTIFY_FROM_EVIDENCE__</mutationThreshold>
        <outputFormats>
            <param>HTML</param>
            <param>XML</param>
        </outputFormats>
    </configuration>
</plugin>
```

CI order: `mvn -f tests/team/pit-mutators/pom.xml install`, then
`mvn -f api/pom.xml test-compile org.pitest:pitest-maven:mutationCoverage`.

## Verified so far

This module's 9 tests pass. An end-to-end `pitest-maven` run on the fixture with the wiring
above produced the expected results:

- `DROP_ROLE_ALTERNATIVE` was **killed** by a test that lets a Limited Admin review.
- Both `IGNORE_APPROVAL_STATE` mutants **survived** a test that never tries a double
  approval, which is a correct survivor.

It has **not** yet been run against the real `RequestService`, because no team tests exist yet.

## Maintenance

The operators match the internal class names `com/grash/model/enums/RoleCode` and
`com/grash/model/Request` (constants in each mutator). If upstream renames or moves those
classes, update the constants. The registration test will still pass, but no mutants will be
generated. A zero count for these two mutators in the PIT report is the warning sign.
