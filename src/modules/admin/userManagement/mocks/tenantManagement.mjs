export function snapshotFixture() {
  return { version:1,institution_id:'a',actor_role:'institution_admin',
    roles:[{role_id:'teacher',name:'teacher'}],modules:['simuladores'],requests:[],
    members:[{profile_id:'person',institution_id:'a',email:'docente@example.test',first_name:'Ana',last_name:'Torres',phone:'0991234567',role_name:'teacher',is_active:true,modules:['simuladores']}] };
}
export const assignmentFixture = { institutionId:'a',email:'docente@example.test',roleId:'teacher',firstName:'Ana',lastName:'Torres',phone:'0991234567',modules:['simuladores'] };
