// Pruebas del motor: node tools/test-motor.mjs
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { cargarDatosCon } from '../js/data.js';
import { Partida, construirNecrologia, evaluarDesbloqueos } from '../js/engine.js';
import { rngSemilla } from '../js/simulate.js';
import { aplicarGenero } from '../js/text.js';
import { fileURLToPath } from 'node:url';
const raiz=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const datos = await cargarDatosCon(async r => JSON.parse(await readFile(path.join(raiz,r),'utf8')));
const assert=(c,m)=>{ if(!c){console.log('FALLO',m); process.exitCode=1;} else console.log('ok',m); };
// play many games w/ prudent-ish (always pick side keeping safe) using immortal: reset pilares each turn
function jugar(sexo, rasgo, seed){ const p=new Partida(datos,{sexo,rasgoId:rasgo,rng:rngSemilla(seed)}); const vistas=[]; 
 while(!p.fin){ const c=p.siguienteCarta(); if(!c) break; vistas.push([c.id,p.anio]); for(const k in p.pilares)p.pilares[k]=50; p.elegir('izquierda'); }
 return {p,vistas}; }
let uroF=0, reglaM=0, anclaMal=0, coche=0; const anclas=Object.fromEntries(datos.cartas.filter(c=>c.tipo==='ancla'&&!c.condiciones&&!c.grupo).map(c=>[c.id,c.anio]));
for(let i=0;i<300;i++){ for(const s of ['M','F']){ const {p,vistas}=jugar(s,'ciudadano_estandar',i+1);
  for(const [id,a] of vistas){ if(id==='urologo'&&s==='F')uroF++; if(id==='regla_educacion_fisica'&&s==='M')reglaM++; if(id in anclas && anclas[id]!==a) anclaMal++; if(id==='coche_18')coche++; }
}}
assert(uroF===0,'urólogo nunca sale a mujeres'); assert(reglaM===0,'regla nunca sale a hombres'); assert(anclaMal===0,'anclas en su año exacto'); assert(coche===0,'carta de rasgo no sale sin rasgo');
// all anchors appear for ciudadano
const {vistas}=jugar('M','ciudadano_estandar',7); for(const id in anclas) assert(vistas.some(v=>v[0]===id), 'ancla vista '+id);
// trait hijo de papá
let p=new Partida(datos,{sexo:'M',rasgoId:'hijo_de_papa'}); assert(p.pilares.dinero===80,'hijo de papá empieza en 80');
p.carta={tags:[]}; let e=p.calcularEfectos({dinero:-15,cordura:-10}); assert(e.dinero===-8&&e.cordura===-20,'hijo de papá x0.5 dinero(−7.5→−8) y x2 cordura '+JSON.stringify(e));
p=new Partida(datos,{sexo:'M',rasgoId:'psicopata_funcional'}); e=p.calcularEfectos({vinculos:-10,cordura:-10}); assert(!e.cordura&&e.vinculos===-10,'psicópata anula cordura');
e=p.calcularEfectos({vinculos:10}); assert(e.vinculos===8,'psicópata sube vínculos x0.75 (7.5→8)');
p=new Partida(datos,{sexo:'M',rasgoId:'sindrome_del_impostor'}); p.avanzarHasta(11); assert(p.pilares.cordura===40,'impostor −5 a los 5 y 10: '+p.pilares.cordura);
// comodines
p=new Partida(datos,{sexo:'M',comodinId:'segunda_opinion'}); p.carta=p.porId.get('obstetra'); p.usarComodin(); assert(JSON.stringify(p.vistaPrevia('izquierda'))==='{"salud":-10,"cordura":10}','segunda opinión invierte');
p=new Partida(datos,{sexo:'M',comodinId:'orfidal'}); p.siguienteCarta(); p.pilares.cordura=20; p.usarComodin(); p.elegir('izquierda'); assert(p.pilares.cordura===50,'orfidal congela'); p.avanzarHasta(6); assert(!p.congelado,'orfidal caduca');
p=new Partida(datos,{sexo:'M',comodinId:'bomba_humo'}); const c1=p.siguienteCarta(); p.usarComodin(); assert(p.pilares.salud===50 && p.siguienteCarta().id!==c1.id,'bomba de humo descarta');
p=new Partida(datos,{sexo:'M',comodinId:'llamar_contacto'}); p.siguienteCarta(); p.usarComodin(); assert(p.pilares.dinero===75&&p.pilares.vinculos===25,'contacto +25/−25');
assert(aplicarGenero('maj{o/a} {el/la} señor{/a}','F')==='maja la señora','género F'); assert(aplicarGenero('maj{o/a}','M')==='majo','género M');
// muerte y necrológica
p=new Partida(datos,{sexo:'F'}); p.carta=p.porId.get('obstetra'); p.pilares.salud=5; p.elegir('derecha'); assert(p.fin?.causa.pilar==='salud','muerte por salud 0');
p=new Partida(datos,{sexo:'F'}); p.avanzarHasta(100); p.siguienteCarta(); p.elegir('izquierda'); assert(p.fin?.causa.tipo==='centenario','centenario');
assert(construirNecrologia(p).titulo==='Condena prorrogada' && construirNecrologia(p).cabecera==='Fe de vida','fluorescente: condena prorrogada');
// profesiones excluyentes y cartas que abarcan dos etapas
p=new Partida(datos,{sexo:'M'}); p.flags.add('oficinista'); p.carta=p.porId.get('examen_mir'); p.elegir('izquierda');
assert(p.flags.has('medico')&&!p.flags.has('oficinista'),'MIR activa médico y quita oficinista');
p.carta=p.porId.get('bootcamp'); p.elegir('izquierda'); assert(p.flags.has('informatico')&&!p.flags.has('medico'),'una sola profesión a la vez');
p=new Partida(datos,{sexo:'M'}); p.flags.add('medico'); p.avanzarHasta(40); assert(p.disponiblesEtapa(40).some(c=>c.id==='guardia_24h'),'guardia (18-49) disponible a los 40');
// lote 6: boda, familia, epidural, final, remates
p=new Partida(datos,{sexo:'F',rng:rngSemilla(1)}); p.avanzarHasta(22); for(const c of datos.cartas) if(c.tipo==='ancla'&&c.anio<=22) p.usadas.add(c.id); p.carta=p.porId.get('test_embarazo'); p.elegir('izquierda');
assert(p.flags.has('embarazada')&&!p.flags.has('con_hijos'),'test de embarazo: embarazada');
{ let vista=null; for(let k=0;k<6&&!vista;k++){ const c=p.siguienteCarta(); for(const x in p.pilares)p.pilares[x]=50; if(c.id==='epidural')vista=p.anio; else p.elegir('izquierda'); }
  assert(vista!==null && vista<=24,'epidural sale al año siguiente ('+vista+')'); p.elegir('derecha'); assert(p.flags.has('con_hijos')&&!p.flags.has('embarazada'),'epidural: con_hijos'); }
p=new Partida(datos,{sexo:'M'}); p.avanzarHasta(30); p.carta=p.porId.get('formar_familia'); p.elegir('izquierda'); assert(p.flags.has('con_hijos')&&!p.flags.has('embarazada'),'familia hombre: con_hijos sin embarazo');
assert(p.cola.length===1 && !require_ok(p),'epidural encolada pero no sale a hombres');
function require_ok(p){ for(let k=0;k<4;k++){ const c=p.siguienteCarta(); if(c?.id==='epidural') return true; for(const x in p.pilares)p.pilares[x]=50; p.elegir('izquierda'); } return false; }
p=new Partida(datos,{sexo:'M'}); p.carta=p.porId.get('boda'); p.elegir('izquierda'); assert(p.flags.has('casado')&&!p.flags.has('soltero'),'boda: casado');
p.carta=p.porId.get('divorcio'); p.elegir('izquierda'); assert(p.flags.has('divorciado')&&!p.flags.has('casado'),'divorcio: divorciado');
p=new Partida(datos,{sexo:'F'}); p.avanzarHasta(100); assert(p.siguienteCarta()?.id==='centenario','carta del año 100'); p.elegir('izquierda'); assert(p.fin?.causa.tipo==='centenario','la carta final termina la partida');
const nec=construirNecrologia(p); assert(nec.remates.length===2 && nec.remates.some(r=>r.includes('Héroe nacional')) && !nec.remates.some(r=>r.includes('COBOL')),'condena prorrogada: héroe nacional');
p=new Partida(datos,{sexo:'M',rasgoId:'genetica_de_cucaracha'}); e=p.calcularEfectos({salud:-10}); const e2=p.calcularEfectos({salud:10}); assert(e.salud===-7&&e2.salud===7,'cucaracha pérdidas x0.65 (−6.5→−7), ganancias x0.7');
p=new Partida(datos,{sexo:'F'}); p.avanzarHasta(9); p.siguienteCarta(); p.pilares.dinero=105; p.comprobarMuerte(); assert(construirNecrologia(p).texto.includes('atragantada'),'muerte infantil por dinero 100, en femenino');
// desbloqueo por cualquier extremo
{ const nuevos=evaluarDesbloqueos(datos,{causa:{tipo:'muerte',pilar:'cordura',extremo:0}},[]); assert(nuevos.some(r=>r.id==='sindrome_del_impostor'),'impostor se desbloquea también con Cordura a 0'); }
// lote 15: comodines desbloqueables, viejo rencoroso, tos de la pareja
{ const { comodinesDisponibles }=await import('../js/engine.js');
  assert(comodinesDisponibles(datos,[]).map(c=>c.id).join()==='bomba_humo','solo la bomba de humo al principio');
  const n41=evaluarDesbloqueos(datos,{anio:41,causa:{tipo:'muerte',pilar:'salud',extremo:0}},[]).map(x=>x.id); assert(n41.includes('orfidal')&&!n41.includes('llamar_contacto'),'orfidal al superar 40');
  const n100=evaluarDesbloqueos(datos,{anio:100,causa:{tipo:'centenario'}},[]).map(x=>x.id); assert(n100.includes('viejo_rencoroso')&&n100.includes('llamar_contacto'),'centenario: viejo rencoroso + contacto');
  const nv=evaluarDesbloqueos(datos,{anio:20,causa:{tipo:'muerte',pilar:'vinculos',extremo:100}},[]).map(x=>x.id); assert(nv.includes('segunda_opinion'),'segunda opinión al morir por una barra al 100'); }
p=new Partida(datos,{sexo:'M',rasgoId:'viejo_rencoroso'}); assert(p.pilares.salud===35&&p.pilares.cordura===65,'viejo rencoroso empieza 35/65');
p.carta={tags:[]}; e=p.calcularEfectos({vinculos:-10,dinero:5}); assert(e.salud===5,'bajar vínculos da +5 salud');
p=new Partida(datos,{sexo:'M',rasgoId:'psicopata_funcional'}); p.carta={tags:[]}; e=p.calcularEfectos({dinero:10}); assert(e.dinero===12,'psicópata gana un 20% más de dinero');
assert(datos.cartas.find(c=>c.id==='curso_inem').etapa==='18-49','curso del INEM desde los 18');
// guardar/restaurar, variantes de texto, final con texto propio
{ const p1=new Partida(datos,{sexo:'F',rasgoId:'hijo_de_papa',comodinId:'orfidal',rng:rngSemilla(4)}); for(let k=0;k<30;k++){ p1.siguienteCarta(); for(const x in p1.pilares)p1.pilares[x]=50; p1.elegir('izquierda'); } p1.siguienteCarta();
  const p2=Partida.restaurar(datos, JSON.parse(JSON.stringify(p1.exportar())));
  assert(p2 && p2.carta.id===p1.carta.id && p2.anio===p1.anio && JSON.stringify(p2.pilares)===JSON.stringify(p1.pilares) && [...p2.flags].join()===[...p1.flags].join() && p2.rasgo.id==='hijo_de_papa','restaurar partida guardada (año '+p1.anio+')'); }
{ const c=datos.cartas.find(x=>x.id==='centenario'); const a=new Partida(datos,{sexo:'M'}); const b=new Partida(datos,{sexo:'M'}); b.flags.add('con_hijos');
  assert(!a.textoDe(c).includes('biznietos') && b.textoDe(c).includes('biznietos'),'biznietos solo con hijos'); }
{ const a=new Partida(datos,{sexo:'F'}); a.avanzarHasta(100); a.siguienteCarta(); a.elegir('derecha'); const n=construirNecrologia(a);
  assert(n.texto.includes('guardería') && n.rango==='Edad oficial: 00 años' && n.cabecera==='Fe de vida' && !n.remates.some(r=>/funeral|Epitafio|forense/.test(r)),'la prórroga: fe de vida, edad 00 y sin remates de funeral'); }
// anclas alternativas y arcos
{ const vistos={}; for(let s=1;s<=300;s++){ const p=new Partida(datos,{sexo:'M',rng:rngSemilla(s)}); const c0=p.siguienteCarta(); p.elegir('izquierda'); const c1=p.siguienteCarta(); vistos[c0.id]=(vistos[c0.id]||0)+1; vistos[c1.id]=(vistos[c1.id]||0)+1; if(c0.anio!==0||c1.anio!==1) vistos.mal=(vistos.mal||0)+1; }
  assert(!vistos.mal && ['obstetra','parto_festivo','el_parecido','pediatra_vacunas','primera_palabra','parque_bolas'].every(id=>vistos[id]>50),'años 0 y 1: una carta al azar de cada grupo '+JSON.stringify(vistos)); }
{ const p=new Partida(datos,{sexo:'F'}); p.carta=p.porId.get('comunion'); p.elegir('derecha'); assert(p.flags.has('sobre_comunion'),'la Comunión activa el arco del sobre'); }
{ const a=new Partida(datos,{sexo:'F'}); a.avanzarHasta(100); a.siguienteCarta(); a.elegir('derecha'); const r=construirNecrologia(a).remates;
  assert(r.some(x=>x.includes('COBOL')&&x.includes('derrotada')) && !r.some(x=>x.includes('Héroe nacional')),'error del sistema: remate COBOL, sin héroe nacional'); }
// una ancla cuyo año ya pasó no sale tarde (partidas guardadas con otra versión del mazo)
{ const p=new Partida(datos,{sexo:'M',rng:rngSemilla(2)}); const e=p.exportar(); e.edad=3; e.usadas=['obstetra','pediatra_vacunas']; e.anclasDescartadas=[]; e.cartaId=null;
  const q=Partida.restaurar(datos,e); const c=q.siguienteCarta(); assert(c && c.tipo!=='ancla' && q.anio===3,'ancla de un año pasado no sale tarde ('+c?.id+')'); }
// dificultad: volatilidad desde los 12 y castigo de pérdidas desde los 65
{ const p=new Partida(datos,{sexo:'M'}); p.carta={tags:[]}; const nino=p.calcularEfectos({salud:-10,dinero:10});
  p.avanzarHasta(30); const adulto=p.calcularEfectos({salud:-10,dinero:10}); p.avanzarHasta(70); const viejo=p.calcularEfectos({salud:-10,dinero:10});
  assert(nino.salud===-10 && adulto.salud===-12 && adulto.dinero===12 && viejo.salud===-13 && viejo.dinero===12,'dificultad: '+JSON.stringify([nino,adulto,viejo])); }
