import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFile } from 'fs/promises';

async function run() {
  const config = JSON.parse(
    await readFile('./firebase-applet-config.json', 'utf8')
  );

  initializeApp({
    projectId: config.projectId,
  });

  const email = process.argv[2];
  const role = process.argv[3] || 'superadmin';

  if (!email) {
    console.error("Please provide an email.");
    process.exit(1);
  }

  const auth = getAuth();
  
  try {
    const user = await auth.getUserByEmail(email);
    console.log(`Found user: ${user.uid} (${user.email})`);
    
    const currentClaims = user.customClaims || {};
    
    await auth.setCustomUserClaims(user.uid, {
      ...currentClaims,
      role: role
    });
    
    console.log(`Successfully granted ${role} role to ${email}.`);
  } catch (error) {
    console.error(`Error setting role:`, error);
  }
}

run();
