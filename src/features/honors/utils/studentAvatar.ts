const studentAvatars: Record<string, string> = {
  'emilia zambrano': '/avatares/02_Mateo_Cedeno.png',
  'mateo cedeño': '/avatares/01_Emilia_Zambrano.png',
  'sofía paredes': '/avatares/05_Valentina_Vera.png',
  'joaquín moreira': '/avatares/03_Sofia_Paredes.png',
  'valentina vera': '/avatares/04_Joaquin_Moreira.png',
  'andrés mera': '/avatares/07_Camila_Loor.png',
  'camila loor': '/avatares/06_Andres_Mera.png',
  'daniel mina': '/avatares/09_Luciana_Galarza.png',
  'luciana galarza': '/avatares/08_Daniel_Mina.png',
}

export function getStudentAvatar(name: string): string | undefined {
  return studentAvatars[name.trim().toLocaleLowerCase('es-EC')]
}

export function getStudentInitials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] ?? '').join('').toLocaleUpperCase('es-EC')
}
