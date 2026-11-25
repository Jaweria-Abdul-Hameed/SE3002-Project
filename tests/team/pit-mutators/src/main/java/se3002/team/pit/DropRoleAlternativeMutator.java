package se3002.team.pit;

import org.pitest.mutationtest.engine.MutationIdentifier;
import org.pitest.mutationtest.engine.gregor.MethodInfo;
import org.pitest.mutationtest.engine.gregor.MethodMutatorFactory;
import org.pitest.mutationtest.engine.gregor.MutationContext;
import org.pitest.reloc.asm.MethodVisitor;
import org.pitest.reloc.asm.Opcodes;

/**
 * Business rule (decision with two Boolean conditions), from RequestService.approve / cancel:
 *
 * <pre>
 *   allowed = role.viewPermissions.contains(SETTINGS) || role.code.equals(RoleCode.LIMITED_ADMIN)
 * </pre>
 *
 * This operator removes the second alternative: every {@code RoleCode.equals(...)} call is
 * replaced by the constant {@code false}. A Limited Admin, who has no SETTINGS permission,
 * is then refused. Only a test that approves or cancels as a Limited Admin and expects
 * success can kill the mutant.
 *
 * <p>Bytecode: {@code INVOKEVIRTUAL RoleCode.equals(Object)Z} becomes {@code POP2; ICONST_0}.
 * The two popped values are the receiver and the argument.
 */
public final class DropRoleAlternativeMutator implements MethodMutatorFactory {

    public static final String NAME = "DROP_ROLE_ALTERNATIVE";
    static final String ROLE_CODE = "com/grash/model/enums/RoleCode";

    @Override
    public MethodVisitor create(MutationContext context, MethodInfo methodInfo, MethodVisitor delegate) {
        return new Visitor(this, context, delegate);
    }

    @Override
    public String getGloballyUniqueId() {
        return getClass().getName();
    }

    @Override
    public String getName() {
        return NAME;
    }

    @Override
    public String description() {
        return "Replaces RoleCode.equals(...) with false, removing a role alternative from an authorisation check";
    }

    private static final class Visitor extends MethodVisitor {
        private final MethodMutatorFactory factory;
        private final MutationContext context;

        Visitor(MethodMutatorFactory factory, MutationContext context, MethodVisitor delegate) {
            super(Opcodes.ASM9, delegate);
            this.factory = factory;
            this.context = context;
        }

        @Override
        public void visitMethodInsn(int opcode, String owner, String name, String descriptor, boolean isInterface) {
            if (opcode == Opcodes.INVOKEVIRTUAL
                    && ROLE_CODE.equals(owner)
                    && "equals".equals(name)
                    && "(Ljava/lang/Object;)Z".equals(descriptor)) {
                MutationIdentifier id = context.registerMutation(factory,
                        NAME + ": replaced RoleCode.equals(...) with false (role alternative removed)");
                if (context.shouldMutate(id)) {
                    super.visitInsn(Opcodes.POP2);
                    super.visitInsn(Opcodes.ICONST_0);
                    return;
                }
            }
            super.visitMethodInsn(opcode, owner, name, descriptor, isInterface);
        }
    }
}
