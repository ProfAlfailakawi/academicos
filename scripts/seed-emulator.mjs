import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

if (
  !process.env.FIRESTORE_EMULATOR_HOST ||
  !process.env.FIREBASE_AUTH_EMULATOR_HOST
)
  throw new Error(
    "Refusing to seed without FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST",
  );
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "academicos-local";
initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = getFirestore(),
  auth = getAuth(),
  option = process.argv.find((x) => x.startsWith("--records=")),
  count = Math.min(
    1_000_000,
    Math.max(1_000, Number(option?.split("=")[1] || 100_000)),
  ),
  tenantId = "scale-university",
  emulatorPassword = "AcademicOS!Emulator2026";
const roles = [
  "student",
  "student_group_leader",
  "teaching_assistant",
  "professor",
  "course_coordinator",
  "department_admin",
  "college_admin",
  "university_admin",
  "ai_governance_officer",
  "accreditation_officer",
  "national_admin",
  "employer",
  "support_agent",
  "finance_admin",
  "trust_safety_admin",
  "admin",
  "superadmin",
  "root_owner",
];
for (const role of roles) {
  const uid = `scale-${role.replaceAll("_", "-")}`,
    email = `${role}@scale.academicos.local`;
  try {
    await auth.createUser({
      uid,
      email,
      password: emulatorPassword,
      emailVerified: true,
      displayName: `Scale ${role}`,
    });
  } catch (error) {
    if (error?.code !== "auth/uid-already-exists") throw error;
    await auth.updateUser(uid, {
      password: emulatorPassword,
      emailVerified: true,
      displayName: `Scale ${role}`,
    });
  }
  await auth.setCustomUserClaims(uid, {
    role,
    tenantId,
    emulatorMfaEnrolled: true,
  });
}
const started = Date.now();
for (let offset = 0; offset < count; offset += 450) {
  const batch = db.batch(),
    end = Math.min(count, offset + 450);
  for (let i = offset; i < end; i++) {
    const userId = `scale-student-${i % 10_000}`,
      id = `scale-project-${String(i).padStart(7, "0")}`;
    batch.set(db.collection("projects").doc(id), {
      id,
      tenantId,
      userId,
      title: `مشروع قياس ${i}`,
      course: `COURSE-${i % 5000}`,
      status: i % 7 === 0 ? "completed" : "active",
      progress: i % 101,
      updatedAt: new Date(1_700_000_000_000 + i).toISOString(),
      createdAt: new Date(1_690_000_000_000 + i).toISOString(),
    });
  }
  await batch.commit();
  if (offset && offset % 45_000 === 0) console.log(`seeded ${offset}/${count}`);
}
console.log(
  JSON.stringify({
    seeded: count,
    roles: roles.length,
    elapsedSeconds: Number(((Date.now() - started) / 1000).toFixed(1)),
    emulator: true,
    authentication: "firebase-emulator-token",
  }),
);
