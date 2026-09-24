export const EWU_STUDENT_ID_PATTERN = /^\d{4}-\d-\d{2}-\d{2,3}$/;

export const normalizeStudentId = (value = "") =>
  String(value).trim().replace(/\s+/g, "").toLowerCase();

export const isValidStudentId = (value = "") =>
  EWU_STUDENT_ID_PATTERN.test(normalizeStudentId(value));

export const studentIdToEmail = (value = "") =>
  `${normalizeStudentId(value)}@std.ewubd.edu`;
