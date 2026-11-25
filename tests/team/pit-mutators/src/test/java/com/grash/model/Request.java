package com.grash.model;

/** Test stand-in with the same binary name and getter as Atlas's Request entity. */
public class Request {
    private WorkOrder workOrder;

    public WorkOrder getWorkOrder() {
        return workOrder;
    }

    public void setWorkOrder(WorkOrder workOrder) {
        this.workOrder = workOrder;
    }
}
