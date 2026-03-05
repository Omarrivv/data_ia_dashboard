"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatasetStatus = exports.ProjectStatus = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["USER"] = "user";
    UserRole["ADMIN"] = "admin";
})(UserRole || (exports.UserRole = UserRole = {}));
var ProjectStatus;
(function (ProjectStatus) {
    ProjectStatus["DRAFT"] = "draft";
    ProjectStatus["ANALYZING"] = "analyzing";
    ProjectStatus["READY"] = "ready";
    ProjectStatus["ERROR"] = "error";
})(ProjectStatus || (exports.ProjectStatus = ProjectStatus = {}));
var DatasetStatus;
(function (DatasetStatus) {
    DatasetStatus["UPLOADING"] = "uploading";
    DatasetStatus["PROCESSING"] = "processing";
    DatasetStatus["READY"] = "ready";
    DatasetStatus["ERROR"] = "error";
})(DatasetStatus || (exports.DatasetStatus = DatasetStatus = {}));
//# sourceMappingURL=index.js.map