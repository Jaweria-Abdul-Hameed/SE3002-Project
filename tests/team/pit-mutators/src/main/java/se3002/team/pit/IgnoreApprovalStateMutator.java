package se3002.team.pit;

import org.pitest.mutationtest.engine.MutationIdentifier;
import org.pitest.mutationtest.engine.gregor.MethodInfo;
import org.pitest.mutationtest.engine.gregor.MethodMutatorFactory;
import org.pitest.mutationtest.engine.gregor.MutationContext;
import org.pitest.reloc.asm.Handle;
import org.pitest.reloc.asm.Label;
import org.pitest.reloc.asm.MethodVisitor;
import org.pitest.reloc.asm.Opcodes;

/**
 * Business rule (change of state), from RequestService.approveInternal / cancel / patch:
 * a request whose work order is already set has been approved. It cannot be approved
 * again, cancelled, or edited.
 *
 * <pre>
 *   if (savedRequest.getWorkOrder() != null) throw "Request is already approved";
 * </pre>
 *
 * This operator makes the code act as if the request were still pending. Each
 * {@code request.getWorkOrder()} result that goes straight into a null check is treated as
 * null. That removes the guard on the approved state and allows forbidden transitions such
 * as approved to approved and approved to cancelled.
 *
 * <p>Bytecode: {@code INVOKEVIRTUAL Request.getWorkOrder()} followed directly by
 * {@code IFNULL L} becomes {@code POP; GOTO L}, so the branch is always taken. When it is
 * followed by {@code IFNONNULL L}, it becomes {@code POP}, so the branch is never taken.
 * Calls that don't feed a null check are left alone.
 */
public final class IgnoreApprovalStateMutator implements MethodMutatorFactory {

    public static final String NAME = "IGNORE_APPROVAL_STATE";
    static final String REQUEST = "com/grash/model/Request";

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
        return "Treats Request.getWorkOrder() as null in null checks, ignoring the approved state";
    }

    private static final class Visitor extends MethodVisitor {
        private final MethodMutatorFactory factory;
        private final MutationContext context;
        /** True when the previous instruction was a call to Request.getWorkOrder(). */
        private boolean afterGetWorkOrder;

        Visitor(MethodMutatorFactory factory, MutationContext context, MethodVisitor delegate) {
            super(Opcodes.ASM9, delegate);
            this.factory = factory;
            this.context = context;
        }

        @Override
        public void visitMethodInsn(int opcode, String owner, String name, String descriptor, boolean isInterface) {
            afterGetWorkOrder = false;
            super.visitMethodInsn(opcode, owner, name, descriptor, isInterface);
            afterGetWorkOrder = opcode == Opcodes.INVOKEVIRTUAL
                    && REQUEST.equals(owner)
                    && "getWorkOrder".equals(name)
                    && descriptor.startsWith("()L");
        }

        @Override
        public void visitJumpInsn(int opcode, Label label) {
            boolean nullCheckOnWorkOrder = afterGetWorkOrder
                    && (opcode == Opcodes.IFNULL || opcode == Opcodes.IFNONNULL);
            afterGetWorkOrder = false;
            if (nullCheckOnWorkOrder) {
                MutationIdentifier id = context.registerMutation(factory,
                        NAME + ": treated Request.getWorkOrder() as null (approved-state guard ignored)");
                if (context.shouldMutate(id)) {
                    super.visitInsn(Opcodes.POP);
                    if (opcode == Opcodes.IFNULL) {
                        super.visitJumpInsn(Opcodes.GOTO, label);
                    }
                    return;
                }
            }
            super.visitJumpInsn(opcode, label);
        }

        // Any other instruction breaks the "call followed directly by null check" pattern.

        @Override
        public void visitInsn(int opcode) {
            afterGetWorkOrder = false;
            super.visitInsn(opcode);
        }

        @Override
        public void visitIntInsn(int opcode, int operand) {
            afterGetWorkOrder = false;
            super.visitIntInsn(opcode, operand);
        }

        @Override
        public void visitVarInsn(int opcode, int varIndex) {
            afterGetWorkOrder = false;
            super.visitVarInsn(opcode, varIndex);
        }

        @Override
        public void visitTypeInsn(int opcode, String type) {
            afterGetWorkOrder = false;
            super.visitTypeInsn(opcode, type);
        }

        @Override
        public void visitFieldInsn(int opcode, String owner, String name, String descriptor) {
            afterGetWorkOrder = false;
            super.visitFieldInsn(opcode, owner, name, descriptor);
        }

        @Override
        public void visitInvokeDynamicInsn(String name, String descriptor, Handle bootstrapMethodHandle,
                                           Object... bootstrapMethodArguments) {
            afterGetWorkOrder = false;
            super.visitInvokeDynamicInsn(name, descriptor, bootstrapMethodHandle, bootstrapMethodArguments);
        }

        @Override
        public void visitLdcInsn(Object value) {
            afterGetWorkOrder = false;
            super.visitLdcInsn(value);
        }

        @Override
        public void visitIincInsn(int varIndex, int increment) {
            afterGetWorkOrder = false;
            super.visitIincInsn(varIndex, increment);
        }

        @Override
        public void visitTableSwitchInsn(int min, int max, Label dflt, Label... labels) {
            afterGetWorkOrder = false;
            super.visitTableSwitchInsn(min, max, dflt, labels);
        }

        @Override
        public void visitLookupSwitchInsn(Label dflt, int[] keys, Label[] labels) {
            afterGetWorkOrder = false;
            super.visitLookupSwitchInsn(dflt, keys, labels);
        }

        @Override
        public void visitMultiANewArrayInsn(String descriptor, int numDimensions) {
            afterGetWorkOrder = false;
            super.visitMultiANewArrayInsn(descriptor, numDimensions);
        }
    }
}
