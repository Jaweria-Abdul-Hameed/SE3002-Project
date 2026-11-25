package com.grash.model;

import com.grash.model.enums.RoleCode;

import java.util.Set;

/** Test stand-in for Atlas's Role (view permissions simplified to strings). */
public class Role {
    private final RoleCode code;
    private final Set<String> viewPermissions;

    public Role(RoleCode code, Set<String> viewPermissions) {
        this.code = code;
        this.viewPermissions = viewPermissions;
    }

    public RoleCode getCode() {
        return code;
    }

    public Set<String> getViewPermissions() {
        return viewPermissions;
    }
}
