// Pruebas del motor: node tools/test-motor.mjs
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { cargarDatosCon } from '../js/data.js';
import { Partida, construirNecrologia } from '../js/engine.js';
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
let uroF=0, reglaM=0, anclaMal=0, coche=0; const anclas=Object.fromEntries(datos.cartas.filter(c=>c.tipo==='ancla').map(c=>[c.id,c.anio]));
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
e=p.calcularEfectos({vinculos:10}); assert(e.vinculos===5,'psicópata sube vínculos a la mitad');
p=new Partida(datos,{sexo:'M',rasgoId:'sindrome_impostor'}); p.avanzarHasta(11); assert(p.pilares.cordura===30,'impostor −10 a los 5 y 10: '+p.pilares.cordura);
// comodines
p=new Partida(datos,{sexo:'M',comodinId:'segunda_opinion'}); p.siguienteCarta(); p.usarComodin(); assert(JSON.stringify(p.vistaPrevia('izquierda'))==='{"salud":-10,"cordura":10}','segunda opinión invierte');
p=new Partida(datos,{sexo:'M',comodinId:'orfidal'}); p.siguienteCarta(); p.pilares.cordura=20; p.usarComodin(); p.elegir('izquierda'); assert(p.pilares.cordura===50,'orfidal congela'); p.avanzarHasta(6); assert(!p.congelado,'orfidal caduca');
p=new Partida(datos,{sexo:'M',comodinId:'bomba_humo'}); const c1=p.siguienteCarta(); p.usarComodin(); assert(p.pilares.salud===50 && p.siguienteCarta().id!==c1.id,'bomba de humo descarta');
p=new Partida(datos,{sexo:'M',comodinId:'llamar_contacto'}); p.siguienteCarta(); p.usarComodin(); assert(p.pilares.dinero===75&&p.pilares.vinculos===25,'contacto +25/−25');
assert(aplicarGenero('maj{o/a} {el/la} señor{/a}','F')==='maja la señora','género F'); assert(aplicarGenero('maj{o/a}','M')==='majo','género M');
// muerte y necrológica
p=new Partida(datos,{sexo:'F'}); p.siguienteCarta(); p.pilares.salud=5; p.elegir('derecha'); assert(p.fin?.causa.pilar==='salud','muerte por salud 0');
p=new Partida(datos,{sexo:'F'}); p.avanzarHasta(100); assert(p.siguienteCarta()===null && p.fin.causa.tipo==='centenario','centenario');
assert(construirNecrologia(p).titulo==='Centenaria','título centenaria con género');
// profesiones excluyentes y cartas que abarcan dos etapas
p=new Partida(datos,{sexo:'M'}); p.flags.add('oficinista'); p.carta=p.porId.get('examen_mir'); p.elegir('izquierda');
assert(p.flags.has('medico')&&!p.flags.has('oficinista'),'MIR activa médico y quita oficinista');
p.carta=p.porId.get('bootcamp'); p.elegir('izquierda'); assert(p.flags.has('informatico')&&!p.flags.has('medico'),'una sola profesión a la vez');
p=new Partida(datos,{sexo:'M'}); p.flags.add('medico'); p.avanzarHasta(40); assert(p.disponiblesEtapa(40).some(c=>c.id==='guardia_24h'),'guardia (18-49) disponible a los 40');
