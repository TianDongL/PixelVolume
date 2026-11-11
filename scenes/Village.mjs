import * as T from 'three';

// Scene geometry and motion adapted from 雾溪村 · Alderwick at Dusk.
export function createVillageScene() {
  const scene = new T.Scene();
  const renderer = new T.WebGLRenderer({ alpha: false, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, .2, 245);
  const { sin, cos, sqrt, abs, PI, max, min } = Math;
  const TAU = PI * 2;
  const v = (x, y, z) => new T.Vector3(x, y, z);
  const clamp = (n, lo = 0, hi = 1) => max(lo, min(hi, n));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, n) => { const t = clamp((n - a) / (b - a)); return t * t * (3 - 2 * t); };
  let seed = 1979;
  const random = () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
  const range = (a, b) => mix(a, b, random());
  const pick = items => items[Math.floor(random() * items.length)];
  scene.fog = new T.Fog(0xdec0a0, 93, 167);
  const sky = new T.HemisphereLight(0xffeed5, 0x827370, 1.65);
  scene.add(sky);
  const sun = new T.DirectionalLight(0xffcb8f, 2.75);
  sun.position.set(-39, 28, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left:-41, right:41, top:38, bottom:-38, near:2, far:113 });
  sun.shadow.normalBias = .075;
  sun.shadow.bias = -.00035;
  sun.shadow.radius = 3;
  scene.add(sun);
  const fill = new T.DirectionalLight(0xc0d0ef, .55);
  fill.position.set(35, 31, -26);
  scene.add(fill);

  // Surfaces are painted in memory. The color and shallow relief share a pattern.
  function paint(size, draw, repeatX = 1, repeatY = 1) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    draw(ctx, size);
    const map = new T.CanvasTexture(c);
    map.colorSpace = T.SRGBColorSpace;
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.repeat.set(repeatX, repeatY);
    map.anisotropy = min(8, renderer.capabilities.getMaxAnisotropy());
    return map;
  }
  const grain = paint(256, (ctx, s) => {
    ctx.fillStyle = '#ece0c7'; ctx.fillRect(0,0,s,s);
    for (let j = 0; j < 850; j++) {
      ctx.strokeStyle = random() < .58 ? 'rgba(49,30,13,.13)' : 'rgba(255,255,255,.29)';
      ctx.lineWidth = range(.3,1.8);
      const x = range(0,s), y = range(0,s);
      ctx.beginPath(); ctx.moveTo(x,y);
      ctx.bezierCurveTo(x + 31,y + range(-4,4),x + 54,y + range(-3,3),x + range(63,151),y);
      ctx.stroke();
    }
  });
  const shingles = paint(512, (ctx, s) => {
    ctx.fillStyle = '#7e635b'; ctx.fillRect(0,0,s,s);
    const rows = 13, cols = 9;
    const tw = s / cols, th = s / rows;
    for (let row = 0; row < rows; row++) {
      for (let col = -1; col <= cols; col++) {
        const x = col * tw + (row % 2) * tw * .5, y = row * th;
        const light = range(52, 82);
        const shade = ctx.createLinearGradient(x,y,x,y+th);
        shade.addColorStop(0, 'hsl(24,11%,' + (light - 9) + '%)');
        shade.addColorStop(.73, 'hsl(23,15%,' + light + '%)');
        shade.addColorStop(1, 'hsl(22,15%,' + (light + 11) + '%)');
        ctx.fillStyle = shade;
        ctx.beginPath(); ctx.roundRect(x+.8,y+.5,tw-1.6,th-1.3,[0,0,4,4]); ctx.fill();
        ctx.fillStyle = '#f5e5d02c'; ctx.fillRect(x+2,y+th-3,tw-4,1);
        for(let k=0;k<10;k++){
          ctx.fillStyle = k%2 ? '#39231827' : '#f8eedc36';
          ctx.fillRect(x+range(1,tw-1),y+range(1,th-8),range(.4,1.6),range(2,8));
        }
      }
    }
  });
  const brick = paint(384, (ctx, s) => {
    ctx.fillStyle='#81766a'; ctx.fillRect(0,0,s,s);
    const tw=s/5, th=s/8;
    for(let j=0;j<8;j++) for(let i=-1;i<6;i++) {
      const x=(i+(j%2)*.5)*tw, y=j*th;
      const light=range(64,83);
      ctx.fillStyle='hsl(32,12%,'+light+'%)';
      ctx.beginPath();ctx.roundRect(x+1.5,y+1.2,tw-3.2,th-2.8,range(3,9));ctx.fill();
      ctx.fillStyle='#fff8e651';ctx.fillRect(x+7,y+2,tw-14,1.6);
      for(let k=0;k<24;k++){
        ctx.fillStyle= k%2 ? '#53463825' : '#fff4d94c';
        ctx.fillRect(x+range(5,tw-6),y+range(4,th-5),range(1,4),1);
      }
    }
  });
  const mottled = (ground, flecks, repeats = 1) => paint(256, (ctx, s) => {
    ctx.fillStyle = ground;ctx.fillRect(0,0,s,s);
    for (let j=0;j<2100;j++) {
      const x=range(0,s),y=range(0,s);
      ctx.fillStyle=pick(flecks);
      ctx.fillRect(x,y,range(.6,4.7),range(.6,2.6));
    }
  }, repeats,repeats);
  const turfMap = mottled('#d6d0a9',['#6b723f31','#eddfab99','#9ba05b70','#c2b67e99'], 1);
  const dust = mottled('#e7d9bc',['#b18e683a','#f9ecc2aa','#a08a6826','#f6ead799']);
  const plaster = mottled('#f5e7cc',['#af967435','#fffcdf80','#75684e1c']);
  const radial = (stops) => paint(128, (ctx, size) => {
    const c = size*.5;
    const gradient = ctx.createRadialGradient(c,c,0,c,c,c);
    for (const [stop,color] of stops) gradient.addColorStop(stop,color);
    ctx.fillStyle=gradient; ctx.fillRect(0,0,size,size);
  });
  const haloMap = radial([[0,'#fffbdcff'],[.20,'#ffd27c9a'],[.52,'#f6a0403d'],[1,'#f6a04000']]);
  const shadowMap = radial([[0,'#2e1e16bf'],[.37,'#39241b8a'],[.67,'#4d2e2240'],[1,'#4d2e2200']]);
  const vaporMap = paint(128,(ctx,size) => {
    for (let j=0;j<19;j++){
      const a=range(0,TAU),r=range(0,28),x=64+cos(a)*r,y=64+sin(a)*r;
      const g=ctx.createRadialGradient(x,y,0,x,y,range(15,34));
      g.addColorStop(0,'#ffffff7e');g.addColorStop(1,'#ffffff00');
      ctx.fillStyle=g;ctx.fillRect(0,0,size,size);
    }
  });
  const mat = (color, extra={}) => new T.MeshStandardMaterial({color,roughness:.86,...extra});
  const timber = mat(0x573423,{map:grain,bumpMap:grain,bumpScale:.045});
  const oak = mat(0x8d5d37,{map:grain,bumpMap:grain,bumpScale:.055});
  const endwood = mat(0xaa7849,{map:grain});
  const iron = mat(0x433c37,{roughness:.48,metalness:.35});
  const stone = mat(0xc1b3a0,{map:brick,bumpMap:brick,bumpScale:.16});
  const stones = [0xb9ad98,0xa99888,0x968a79,0xd2bfa5,0xb2a797].map(c => mat(c));
  const dark = mat(0x362923);
  const moss = [0x637343,0x78804a,0x8b8747,0xa0a265].map(c => mat(c,{flatShading:true}));
  const foliage = [0x547344,0x648348,0x7f944e,0x9ba353,0xb6a64d,0xc39245,0xbc6943,0x94643c,0x416b52,0x365c49].map(c=>mat(c,{flatShading:true,roughness:1}));
  const flowerMats = [0xeac36a,0xe3a483,0xf0e4c3,0xc88a99].map(c=>mat(c));
  const wallMats = [0xe6c68d,0xe7dcc1,0xbbccae,0xdcb7a1,0xd5bd92,0xd8cfb2,0xb7c9cf,0xd79c7d].map(c=>mat(c,{map:plaster,bumpMap:plaster,bumpScale:.055}));
  const roofMats = [0xa65437,0x88433e,0x546c70,0x8b6848,0x617361,0x775459,0x6d5550].map(c=>mat(c,{map:shingles,bumpMap:shingles,bumpScale:.105,side:T.DoubleSide}));
  const windowMats = Array.from({length:8},()=>mat(0x554835,{emissive:0xff9a39,emissiveIntensity:.05,roughness:.45}));
  const cloth = [0xaa503b,0x537a73,0xd7a354,0x865c68].map(c=>mat(c,{side:T.DoubleSide}));
  const linen = mat(0xf3dbad,{side:T.DoubleSide});
  const shadowLayer = new T.Mesh(new T.PlaneGeometry(87,72),new T.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false,opacity:.53,fog:false}));
  shadowLayer.rotation.x=-PI/2;shadowLayer.position.set(3,-4.35,2);scene.add(shadowLayer);
  const ambientShadow=shadowLayer.clone();
  ambientShadow.material=shadowLayer.material.clone();
  ambientShadow.material.opacity=.24;
  ambientShadow.scale.set(1.12,.98,1);
  ambientShadow.position.set(11,-4.34,1);
  scene.add(ambientShadow);

  // Batch repeated hand-built parts by geometry and material to keep the model responsive.
  const cube = new T.BoxGeometry(1,1,1);
  const sphere = new T.SphereGeometry(1,9,6);
  const ico = new T.IcosahedronGeometry(1,1);
  const pebble = new T.DodecahedronGeometry(1,0);
  const cylinder = new T.CylinderGeometry(.5,.5,1,10);
  const taper = new T.CylinderGeometry(.33,.5,1,10);
  const cone = new T.ConeGeometry(.5,1,7);
  const wheelGeometry = new T.TorusGeometry(.5,.064,5,14);
  const ghost = new T.Object3D();
  const batches = new Map();
  const pieceMatrix = new T.Matrix4();
  const turn = new T.Quaternion();

  const up = v(0,1,0);
  const liveGroups = new WeakSet();
  function group(parent, x=0,y=0,z=0,angle=0) {
    const g = new T.Group();
    g.position.set(x,y,z);g.rotation.y=angle;parent.add(g);
    if(liveGroups.has(parent)) liveGroups.add(g);
    return g;
  }
  function live(parent,x=0,y=0,z=0,angle=0) {
    const g=group(parent,x,y,z,angle); liveGroups.add(g);return g;
  }
  function piece(g, geo, material, x,y,z, sx,sy,sz, rx=0,ry=0,rz=0, shadow=true, rotation=null) {
    if(liveGroups.has(g)){
      const mesh = new T.Mesh(geo,material);
      mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);
      if(rotation) mesh.quaternion.copy(rotation); else mesh.rotation.set(rx,ry,rz);
      mesh.castShadow=shadow;mesh.receiveShadow=true;g.add(mesh);return mesh;
    }
    g.updateWorldMatrix(true,false);
    ghost.position.set(x,y,z);ghost.scale.set(sx,sy,sz);
    if(rotation) ghost.quaternion.copy(rotation); else ghost.rotation.set(rx,ry,rz);
    ghost.updateMatrix();
    pieceMatrix.multiplyMatrices(g.matrixWorld,ghost.matrix);
    const key=geo.id+'/'+material.id+'/'+shadow;
    if(!batches.has(key)) batches.set(key,{geo,material,shadow,transforms:[]});
    batches.get(key).transforms.push(pieceMatrix.clone());
  }
  function box(g, m, x,y,z, w,h,d,rx=0,ry=0,rz=0,shadow=true) {
    return piece(g,cube,m,x,y,z,w,h,d,rx,ry,rz,shadow);
  }
  function tube(g, m, a,b,w,d=w,geo=cylinder,shadow=true) {
    const direction = v(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
    const length=direction.length();
    if(length < 1e-4) return;
    turn.setFromUnitVectors(up,direction.multiplyScalar(1/length));
    return piece(g,geo,m,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,w,length,d,0,0,0,shadow,turn);
  }
  const beam = (g,m,a,b,w,d=w,shadow=true) => tube(g,m,a,b,w,d,cube,shadow);
  function surface(g, vertices, triangles, material, uvs=null, colors=null, cast=false) {
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    if(uvs) geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
    if(colors) geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    geometry.setIndex(triangles);geometry.computeVertexNormals();
    const mesh=new T.Mesh(geometry,material);mesh.castShadow=cast;mesh.receiveShadow=true;g.add(mesh);
    return mesh;
  }
  function flush() {
    for(const {geo,material,shadow,transforms} of batches.values()){
      const mesh=new T.InstancedMesh(geo,material,transforms.length);
      for(let i=0;i<transforms.length;i++) mesh.setMatrixAt(i,transforms[i]);
      mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=shadow;mesh.receiveShadow=true;scene.add(mesh);
    }
    batches.clear();
  }
  // A recessed river separates the two hand-cut banks of the terrain model.
  const land = group(scene);
  const zMin=-22, zMax=22;
  const extent = z => 29.3 - 5.7 * Math.pow(abs(z)/22,10) + .46*sin(z*.48)+.32*cos(z*.91);
  const river = z => 9.5 + 2.75*sin(z*.128) - .90*sin(z*.28);
  const riverWidth = z => 3.65+.54*sin(z*.23+1.1)+.24*cos(z*.47);
  const bank = (z, side) => river(z) + side * riverWidth(z);
  const bankDist = (x,z) => abs(x-river(z))-riverWidth(z);
  const terrainBack = -82, terrainFront = 52, zLine = 156;
  const waterY = -.43;
  function height(x,z) {
    const shore=smooth(-.48,1.55,bankDist(x,z));
    const contour=.40+.19*sin(x*.19+z*.15)+.18*cos(z*.30-x*.12)+.09*sin(x*.61)*cos(z*.32);
    const millHill=1.57*Math.exp(-((x-21)**2/35+(z+12.8)**2/25));
    const rearHill=1.0*Math.exp(-((x+17)**2/74+(z+19)**2/15));
    const sideHill = smooth(28, 53, abs(x)) * (2.1 + 1.7 * sin(z * .072 + x * .042));
    const woodedRidge = smooth(22, 57, -z) * (5.5 + 2.8 * cos(x * .079 - z * .038));
    return mix(-.71, contour + millHill + rearHill + sideHill + woodedRidge, shore);
  }
  const turfMat=mat(0xffffff,{map:turfMap,vertexColors:true,roughness:1,side:T.DoubleSide});
  const greenA=new T.Color(0x708351),greenB=new T.Color(0xa8ad66),sand=new T.Color(0xa18c61);
  function terrain(side) {
    const verts=[],idx=[],uv=[],rgb=[];
    const cols=side<0?108:90;
    for(let j=0;j<=zLine;j++){
      const z=mix(terrainBack,terrainFront,j/zLine);
      for(let i=0;i<=cols;i++){
        const t=i/cols;
        const x=side<0 ? mix(-76,bank(z,-1),t) : mix(bank(z,1),76,t);
        verts.push(x,height(x,z),z);uv.push(x*.24,z*.24);
        const green=clamp(.48+.19*sin(x*.57+z*.48)+.16*cos(z*.67-x*.15)+range(-.11,.11));
        const shade=greenA.clone().lerp(greenB,green);
        shade.lerp(sand,1-smooth(0,2.1,bankDist(x,z)));
        rgb.push(shade.r,shade.g,shade.b);
        if(j<zLine && i<cols){
          const k=j*(cols+1)+i;idx.push(k,k+cols+1,k+1,k+1,k+cols+1,k+cols+2);
        }
      }
    }
    surface(land,verts,idx,turfMat,uv,rgb);
  }
  terrain(-1);terrain(1);
  const outline=[];
  for(let i=0;i<=88;i++){const z=mix(zMin,zMax,i/88);outline.push([-extent(z),z]);}
  for(let i=1;i<=88;i++){const x=mix(-extent(zMax),extent(zMax),i/88);outline.push([x,zMax]);}
  for(let i=1;i<=88;i++){const z=mix(zMax,zMin,i/88);outline.push([extent(z),z]);}
  for(let i=1;i<88;i++){const x=mix(extent(zMin),-extent(zMin),i/88);outline.push([x,zMin]);}
  const waterMaterial=mat(0x499893,{roughness:.42,metalness:.10,side:T.DoubleSide});
  const waterUniform={value:0},waterDusk={value:0};
  waterMaterial.onBeforeCompile = shader => {
    shader.uniforms.riverTime=waterUniform;
    shader.uniforms.riverDusk=waterDusk;
    shader.vertexShader='varying vec2 riverUv;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nriverUv=uv;');
    shader.fragmentShader=`
      varying vec2 riverUv;
      uniform float riverTime;
      uniform float riverDusk;
      `+shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      float z=riverUv.y;
      float x=riverUv.x;
      float u=z+riverTime*1.55;
      float a=sin(u*2.25+x*6.2+sin(x*19.0+u*.74)*1.25);
      float b=sin(u*4.5-x*25.0+sin(u*.70+x*8.5));
      float c=sin(u*10.2+x*19.0+sin(x*49.0-u*.9));
      float shimmer=smoothstep(.85,1.59,a*.76+b*.58+c*.29);
      float side=min(x,1.0-x);
      float shallows=1.0-smoothstep(.0,.14,side);
      float edge=1.0-smoothstep(.004,.030,abs(side-.075-.012*sin(u*4.1)));
      vec3 deep=mix(vec3(.056,.190,.169),vec3(.060,.123,.158),riverDusk);
      vec3 teal=mix(vec3(.145,.338,.285),vec3(.092,.195,.218),riverDusk);
      vec3 color=mix(deep,teal,.46+.19*a+.12*b);
      color=mix(color,vec3(.244,.273,.126),shallows*.65);
      color+=shimmer*mix(vec3(.295,.261,.144),vec3(.127,.167,.210),riverDusk);
      color+=edge*(.40+.4*a)*vec3(.153,.206,.144);
      diffuseColor.rgb=color;
      `);
  };
  const riverV=[],riverI=[],riverUV=[];
  for(let j=0;j<=zLine;j++){
    const z=mix(terrainBack,terrainFront,j/zLine);
    for(let i=0;i<=18;i++){
      const t=i/18;
      riverV.push(mix(bank(z,-1)-.36,bank(z,1)+.36,t),waterY,z);
      riverUV.push(t,z);
      if(j<zLine&&i<18){const a=j*19+i;riverI.push(a,a+19,a+1,a+1,a+19,a+20);}
    }
  }
  surface(land,riverV,riverI,waterMaterial,riverUV);

  const paths=group(scene);
  const roadSamples=[];
  const pathMat=mat(0xccb08b,{map:dust,bumpMap:dust,bumpScale:.05,side:T.DoubleSide});
  const cobbleMats=[0xb4a790,0xc2af92,0xa79680,0xb3a28b,0xc5b699,0x978b7a].map(c=>mat(c,{roughness:1}));
  function road(points,width,scatter=20) {
    const curve=new T.CatmullRomCurve3(points.map(([x,z])=>v(x,0,z)));
    const n=Math.ceil(curve.getLength()*2.5);
    for(let j=0;j<=n;j++){const p=curve.getPointAt(j/n);roadSamples.push([p.x,p.z,width*.55]);}
    const vs=[],ids=[],uv=[];
    for(let j=0;j<=n;j++){
      const t=j/n,p=curve.getPointAt(t),d=curve.getTangentAt(t);
      for(let i=0;i<=4;i++){
        const s=(i/4-.5)*width*(1+.095*sin(t*29)+.035*cos(t*69));
        const x=p.x-d.z*s,z=p.z+d.x*s;
        vs.push(x,height(x,z)+.034,z);uv.push(x*.28,z*.28);
        if(j<n && i<4){const k=j*5+i;ids.push(k,k+1,k+5,k+1,k+6,k+5);}
      }
    }
    surface(paths,vs,ids,pathMat,uv);
    for(let j=0;j<scatter;j++){
      const t=range(.01,.99),p=curve.getPointAt(t),d=curve.getTangentAt(t),s=range(-width*.45,width*.45);
      const x=p.x-d.z*s,z=p.z+d.x*s;
      const scale=range(.075,.19);
      piece(paths,pebble,pick(cobbleMats),x,height(x,z)+.037,z,scale*range(1,1.9),range(.023,.045),scale,0,range(0,TAU),0,false);
    }
    return curve;
  }
  const bridgeZ=3.55;
  const bridgeX=river(bridgeZ);
  const westBridge=bridgeX-6.42,eastBridge=bridgeX+6.42;
  const mainWest=[[-26.5,2.8],[-21.2,1.55],[-15.5,.6],[-9.1,.2],[-4.3,1.75],[1.1,3.6],[westBridge,bridgeZ]];
  const mainEast=[[eastBridge,bridgeZ],[19.9,3.8],[23,3.1],[26.7,2.45]];
  road(mainWest,2.55,160);
  road(mainEast,2.3,64);
  road([[-14.8,.9],[-12.7,-3.4],[-12.9,-8],[-15.8,-10.6],[-17.9,-12]],1.65,64);
  road([[-4.3,1.75],[-3.65,-1.8],[-4.9,-7.7],[-4.65,-12.2],[-5.5,-19]],1.5,57);
  road([[-11,1.4],[-12.5,6.9],[-12,10.5],[-11.6,15],[-12.1,20.3]],1.6,60);
  road([[-3.6,3.2],[-3.0,8.5],[-4.8,13],[-4.55,19.5]],1.6,52);
  road([[18,3.7],[18.1,0],[20.5,-4],[22.7,-8],[21.6,-11.3]],1.45,54);
  road([[21.5,3.4],[23.0,6.6],[23.9,11.2],[21.2,17.6]],1.6,52);
  function plaza(cx,cz,rx,rz) {
    const vs=[cx,height(cx,cz)+.043,cz],idx=[],uv=[cx*.3,cz*.3];
    for(let i=0;i<42;i++){
      const a=i*TAU/42,r=1+.045*sin(a*5)+.033*cos(a*9);
      const x=cx+cos(a)*rx*r,z=cz+sin(a)*rz*r;
      vs.push(x,height(x,z)+.048,z);uv.push(x*.3,z*.3);idx.push(0,(i+1)%42+1,i+1);
    }
    surface(paths,vs,idx,pathMat,uv);
    for(let j=0;j<255;j++){
      const a=range(0,TAU),r=sqrt(random())*.97;
      const x=cx+cos(a)*rx*r,z=cz+sin(a)*rz*r;
      const s=range(.095,.23);
      piece(paths,pebble,pick(cobbleMats),x,height(x,z)+.055,z,s*range(1.1,1.65),range(.018,.048),s,0,range(0,TAU),0,false);
    }
  }
  plaza(-8.55,2.9,5.8,4.25);
  plaza(-8.6,7.3,4.7,3.0);

  const village=group(scene);
  const chimneys=[];
  const buildingLots=[];
  function panes(g,x,y,z,w,h,index,shutters=false) {
    const rim=.096;
    box(g,timber,x,y,z,w+rim*2,h+rim*2,.15);
    box(g,windowMats[index%windowMats.length],x,y,z+.084,w,h,.045,0,0,0,false);
    box(g,timber,x,y,z+.126,.075,h,.058);
    box(g,timber,x,y,z+.126,w,.067,.058);
    box(g,oak,x,y-h/2-.09,z+.09,w+.30,.105,.26);
    if(shutters){
      for(const side of [-1,1]){
        const sx=x+side*(w*.77+.095);
        box(g,shutters,sx,y,z+.086,w*.45,h+.06,.115,0,side*.16);
        box(g,timber,sx,y-h*.22,z+.15,w*.43,.041,.055);
        box(g,timber,sx,y+h*.22,z+.15,w*.43,.041,.055);
      }
    }
  }
  function entry(g,x,z,base,w,h,index) {
    box(g,timber,x,base+h*.5,z,w+.25,h+.20,.18);
    box(g,oak,x,base+h*.5,z+.10,w,h,.10);
    for(let i=1;i<5;i++) box(g,timber,x+(i/5-.5)*w,base+h*.5,z+.16,.024,h,.035);
    for(const y of [.25,.72]) box(g,iron,x,base+h*y,z+.183,w*.85,.057,.037);
    piece(g,sphere,endwood,x+w*.29,base+h*.48,z+.22,.067,.067,.055);
    box(g,pick(stones),x,base+.05,z+.22,w+.34,.145,.52);
    if(index%3===0) box(g,pick(stones),x,base-.055,z+.48,w+.46,.13,.43);
  }
  function gableRoof(g,w,d,eave,rise,wall,roof,shift=0,detail=true) {
    const hw=w/2,hd=d/2,ex=hw+.26,ez=hd+.34;
    surface(g,[-hw,eave,hd,hw,eave,hd,shift,eave+rise,hd,-hw,eave,-hd,hw,eave,-hd,shift,eave+rise,-hd],
      [0,1,2,3,5,4],wall,[0,0,1,0,.5,1,0,0,1,0,.5,1],null,true);
    const corners=[
      [-ex,eave-.12,-ez,-ex,eave-.12,ez,shift,eave+rise,ez,shift,eave+rise,-ez],
      [ex,eave-.12,ez,ex,eave-.12,-ez,shift,eave+rise,-ez,shift,eave+rise,ez]
    ];
    for(const coords of corners){
      surface(g,coords,[0,1,2,0,2,3],roof,[0,0,1,0,1,1,0,1],null,true);
      const a=coords.slice(0,3),b=coords.slice(3,6),c=coords.slice(6,9),d=coords.slice(9,12);
      beam(g,timber,a,b,.142,.15);beam(g,timber,b,c,.165,.19);beam(g,timber,d,a,.165,.19);
      if(detail){
        for(let i=0;i<7;i++){
          const z=mix(a[2],b[2],(i+.55)/7);
          beam(g,oak,[a[0]+(shift-a[0])*.12,eave+.03,z],[a[0]+(shift-a[0])*.03,eave-.16,z],.105,.12);
        }
      }
    }
    beam(g,roof,[shift,eave+rise+.025,-ez-.055],[shift,eave+rise+.025,ez+.055],.19,.20);
    for(const side of [-1,1]){
      const z=side*(hd+.027);
      beam(g,timber,[-hw,eave,z],[hw,eave,z],.15,.17);
      beam(g,timber,[shift,eave+.02,z],[shift,eave+rise-.08,z],.125,.16);
      if(detail) for(const x of [-1,1]){
        beam(g,timber,[x*hw*.42,eave+.05,z],[shift,eave+rise*.64,z],.12,.15);
      }
    }
  }
  function house(x,z,w,d,h,r,angle,variant,index) {
    const y=height(x,z)-.05;
    const g=group(village,x,y,z,angle);
    const wall=wallMats[index%wallMats.length],roof=roofMats[(index*3+Math.floor(index/3))%roofMats.length];
    const foundation=variant===2?.66:.40;
    box(g,stone,0,foundation*.40,0,w+.18,foundation+.36,d+.18);
    box(g,wall,0,foundation+(h-foundation)/2,0,w,h-foundation,d);
    const level=h*.55;
    const over=variant===1?.16:0;
    if(over) box(g,wall,0,level+(h-level)/2,over,w+.15,h-level,d+over*2);
    gableRoof(g,w+(over?.15:0),d+over*2,h,r,wall,roof,variant===3?w*.13:0);
    for(const side of [-1,1]){
      const facade=group(g,0,0,0,side===1?0:PI);
      const zz=d*.5+.05;
      for(const xx of [-w*.5,0,w*.5]){
        if(xx!==0||side<0||variant===1) box(facade,timber,xx,(h+foundation)/2,zz,.15,h-foundation+.10,.145);
      }
      for(const yy of [foundation,h-.06,...(variant===1?[level]:[])]) box(facade,timber,0,yy,zz,w+.14,.16,.18);
      const xx=w*.28;
      if(side===1) entry(facade,-w*.14,zz,.14,min(.91,w*.27),min(1.70,h*.64),index);
      if(side===-1) panes(facade,-xx,h*.58,zz+.047,.59,.69,index+4);
      panes(facade,xx,variant===1?level*.53+.45:h*.58,zz+.06,min(.78,w*.22),.72,index,variant!==2?roof:false);
      if(variant===1){
        for(const i of [-1,1]) panes(facade,xx*i,level+(h-level)*.53,zz+(side>0?over*2:0)+.085,.63,.72,index+2,roof);
        beam(facade,timber,[-w*.5,level+.09,zz+over*2],[w*.5,level+.09,zz+over*2],.16,.18);
      } else if(w>3.7) {
        beam(facade,timber,[-w*.49,h-.15,zz],[-w*.34,h-.75,zz],.13,.15);
        beam(facade,timber,[w*.49,h-.14,zz],[w*.35,h-.73,zz],.13,.15);
      }
      if(r>1.29){
        const ridge=variant===3?w*.13*side:0;
        panes(facade,ridge,h+r*.34,zz-.009,.39,.48,index+5);
      }
    }
    for(const side of [-1,1]){
      const face=group(g,0,0,0,side*PI/2),zz=w/2+.05;
      for(const yy of [foundation,h-.075,...(variant===1?[level]:[])]) box(face,timber,0,yy,zz,d+.13,.155,.18);
      for(const xx of [-.5,0,.5]) box(face,timber,xx*d,(h+foundation)*.5,zz,.148,h-foundation,.15);
      for(const i of [-1,1]){
        const xx=d*.26*i;
        panes(face,xx,h*.62,zz+.05,.61,.73,index+(i>0?2:1),variant===2?false:roof);
        if(variant===3 || variant===0) beam(face,timber,[i*d*.07,foundation+.02,zz],[i*d*.46,h*.38,zz],.105,.115);
      }
    }
    if(variant===3){
      const annex=group(g,w*.43,.0,d*.41,0);
      box(annex,wall,0,1.10,0,1.74,2.1,1.94);
      gableRoof(annex,1.74,1.94,2.15,.89,wall,roof,0,false);
      panes(annex,0,1.31,1.0,.44,.52,index+3);
      box(annex,timber,0,.32,.99,1.81,.15,.11);
    }
    if(variant===2 || index%5===0){
      const awning=group(g,-w*.14,0,d*.52);
      for(const xx of [-.76,.76]) box(awning,oak,xx,1.03,.97,.105,2.06,.105);
      box(awning,roof,0,2.0,.54,1.75,.115,1.30,.26);
      box(awning,timber,0,1.81,1.10,1.76,.115,.11);
    }
    const chimX=w*(index%2?.29:-.31),chimZ=-d*.23;
    const top=h+r*.89+.52+(index%3)*.16;
    box(g,stone,chimX,top-.52,chimZ,.61,1.04,.70);
    box(g,pick(stones),chimX,top+.025,chimZ,.78,.14,.84);
    box(g,dark,chimX,top+.104,chimZ,.41,.035,.45);
    if(index%3!==2){
      g.updateWorldMatrix(true,false);
      chimneys.push(g.localToWorld(v(chimX,top+.13,chimZ)));
    }
    if(index===0 || index===4 || index===11){
      const zz=d*.5+.28;
      box(g,oak,w*.28,.71,zz,.94,.26,.36);
      for(let i=0;i<8;i++) piece(g,ico,pick(flowerMats),w*.28+range(-.38,.38),range(.83,.97),zz+range(-.15,.15),.075,.078,.075,0,0,0,false);
    }
    buildingLots.push([x,z,max(w,d)*.7+.52]);
  }
  const homes=[
    [-21.9,12.2,4.55,3.65,2.73,1.94,-.21,0],
    [-16.5,16.4,4.00,3.32,2.53,1.69,.22,2],
    [-8.0,16.3,3.77,3.78,3.46,1.9,.15,1],
    [-.5,17.05,4.70,3.65,2.57,1.60,-.2,3],
    [.9,10.3,4.25,3.69,2.74,1.77,.34,0],
    [-18.8,6.1,4.82,3.65,3.22,1.86,-.31,1],
    [-24.2,-4.2,4.20,3.93,3.00,1.81,.18,3],
    [-18.0,-4.9,3.65,4.16,2.62,1.90,-.15,2],
    [-9.6,-6.52,4.0,3.47,3.46,1.92,.06,1],
    [-1.75,-5.7,3.52,3.85,2.75,1.97,-.32,0],
    [3.67,-9.45,3.78,3.58,2.55,1.58,-.32,2],
    [-8.1,-14.8,4.18,4.53,2.94,2.15,.21,3],
    [-.65,-15.55,4.20,3.49,3.37,1.70,.12,1],
    [18.8,10.25,3.55,3.65,2.47,1.60,-.21,2],
    [25.05,6.05,3.52,3.38,2.84,1.63,-.50,0],
    [23.9,-3.9,3.86,3.40,3.09,1.80,.13,3]
  ];
  homes.forEach((spec,i)=>house(...spec,i));
  // Landmark architecture.
  const churchX=-17.4,churchZ=-14.6;
  const church=group(village,churchX,height(churchX,churchZ)-.05,churchZ,-.19);
  buildingLots.push([churchX,churchZ,5.8]);
  const slate=roofMats[2];
  const silver=mat(0xb6a77c,{metalness:.2,roughness:.55});
  function archPanel(g,material,x,y,z,w,h) {
    const shape=new T.Shape();
    shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(w/2,h*.62);
    shape.quadraticCurveTo(w*.46,h*.81,0,h);shape.quadraticCurveTo(-w*.46,h*.81,-w/2,h*.62);
    shape.closePath();
    const mesh=new T.Mesh(new T.ShapeGeometry(shape,9),material);mesh.position.set(x,y,z);g.add(mesh);
  }
  box(church,stone,0,.26,-.8,5.8,.57,8.2);
  box(church,stone,0,2.07,-1.33,4.70,4.1,6.85);
  gableRoof(group(church,0,0,-1.34),4.70,6.85,4.09,2.76,stone,slate);
  const tower=group(church,0,0,2.06);
  box(tower,stone,0,3.79,0,2.64,7.55,2.65);
  for(const y of [.32,2.89,5.51,7.47]) box(tower,pick(stones),0,y,0,2.85,.22,2.86);
  for(const side of [-1,1]){
    for(const depth of [-3.65,-1.78,.12]){
      const face=group(church,side*2.37,0,depth,side*PI/2);
      archPanel(face,dark,0,1.50,.028,.81,1.87);
      archPanel(face,windowMats[(depth<-2?4:6)],0,1.57,.045,.60,1.69);
      box(face,timber,0,2.18,.075,.057,1.18,.073);
      box(face,timber,0,2.15,.075,.58,.058,.075);
      box(face,pick(stones),0,1.47,.08,.92,.14,.35);
      box(face,pick(stones),1.0,1.45,.14,.25,2.91,.44,0,0,0);
    }
  }
  archPanel(tower,dark,0,.18,1.335,1.39,2.42);
  archPanel(tower,oak,0,.24,1.352,1.12,2.20);
  box(tower,pick(stones),0,.16,1.61,1.60,.30,.83);
  box(tower,pick(stones),0,.078,1.94,1.76,.15,.69);
  for(const i of [-1,0,1]) box(tower,timber,i*.25,.91,1.374,.034,1.35,.034);
  for(let k=0;k<4;k++){
    const face=group(tower,0,0,0,k*PI/2);
    archPanel(face,dark,0,5.92,1.333,1.18,1.34);
    archPanel(face,windowMats[7],0,6.0,1.345,.92,1.12);
    for(let i=0;i<4;i++) box(face,oak,0,6.08+i*.19,1.381,.88,.087,.099,.27);
    piece(face,cylinder,pick(stones),0,4.07,1.361,1.15,.15,1.15,PI/2);
    piece(face,cylinder,windowMats[5],0,4.07,1.45,.84,.06,.84,PI/2,0,0,false);
    for(let i=0;i<8;i++){
      const a=i*TAU/8;
      beam(face,timber,[cos(a)*.12,4.07+sin(a)*.12,1.49],[cos(a)*.4,4.07+sin(a)*.4,1.49],.035,.04);
    }
  }
  const spireShape=new T.ConeGeometry(2.03,4.5,4);
  piece(tower,spireShape,slate,0,9.64,0,1,1,1,0,PI/4);
  for(const x of [-1.48,1.48]) for(const z of [-1.48,1.48]) beam(tower,slate,[x,7.45,z],[0,11.93,0],.11,.11);
  piece(tower,sphere,silver,0,11.96,0,.16,.16,.16);
  box(tower,iron,0,12.42,0,.097,1.04,.097);
  box(tower,iron,0,12.57,0,.66,.09,.097);

  const millX=21.45,millZ=-12.8;
  const mill=group(village,millX,height(millX,millZ)-.16,millZ,.27);
  buildingLots.push([millX,millZ,3.9]);
  const millWall=new T.CylinderGeometry(1.53,2.12,5.18,14);
  piece(mill,millWall,stone,0,2.58,0,1,1,1);
  piece(mill,cylinder,pick(stones),0,.30,0,4.45,.55,4.45);
  piece(mill,cylinder,timber,0,5.13,0,3.35,.22,3.35);
  const millCap=new T.ConeGeometry(1.95,2.84,14);
  piece(mill,millCap,roofMats[3],0,6.60,0,1,1,1);
  piece(mill,sphere,oak,0,8.04,0,.15,.19,.15);
  entry(mill,0,2.03,.07,.87,1.65,0);
  panes(group(mill,0,0,0,PI/2),0,2.94,1.79,.58,.78,4);
  panes(group(mill,0,0,0,-PI/2),0,2.94,1.79,.58,.78,3);
  tube(mill,oak,[0,5.72,1.12],[0,5.72,2.38],.37,.37);
  const sailSeam=mat(0xbca989);
  const sails=live(mill,0,5.72,2.30);
  for(let i=0;i<4;i++){
    const g=group(sails);
    g.rotation.z=i*PI/2;
    box(g,timber,0,2.17,0,.178,4.36,.19);
    beam(g,oak,[-.97,4.10,.026],[-.57,1.08,.026],.10,.10);
    for(let j=0;j<10;j++){
      const y=1.10+j*.335,x=-.56-j*.047;
      beam(g,oak,[x,y,.052],[.08,y,.052],.069,.074);
    }
    surface(g,[-.54,1.25,.088,-.08,1.25,.088,-.08,4.07,.088,-.94,4.07,.088],[0,1,2,0,2,3],linen,null,null,true);
    for(let j=0;j<5;j++){
      const y=1.45+j*.58;
      beam(g,sailSeam,[-.565-(y-1.25)*.135,y,.098],[-.075,y,.098],.027,.022,false);
    }
  }
  piece(sails,cylinder,timber,0,0,.079,.63,.27,.63,PI/2);
  piece(sails,cylinder,endwood,0,0,.24,.37,.10,.37,PI/2);

  const bridge=group(scene,bridgeX,0,bridgeZ);
  function bridgeDeck(x) {
    const u=clamp((x-bridgeX+6.42)/12.84);
    return mix(height(westBridge,bridgeZ)+.07,height(eastBridge,bridgeZ)+.07,u)+1.74*sin(u*PI)**1.11;
  }
  function archBottom(x) { return -1.03+2.35*sqrt(max(0,1-(x/4.22)**2)); }
  const bv=[],bi=[],bu=[];
  for(let i=0;i<=60;i++){
    const x=mix(-6.42,6.42,i/60),top=bridgeDeck(bridgeX+x);
    const base=min(top-.22,archBottom(x));
    bv.push(x,top,-1.35,x,top,1.35,x,base,1.35,x,base,-1.35);
    bu.push(x*.26,0,x*.26,1,x*.26,base*.29,x*.26,base*.29);
    if(i<60) for(let j=0;j<4;j++){
      const a=i*4+j,b=i*4+(j+1)%4;
      bi.push(a,b,a+4,b,b+4,a+4);
    }
  }
  surface(bridge,bv,bi,stone,bu,null,true);
  for(let i=0;i<21;i++){
    const a=mix(-6.25,6.25,i/21),b=mix(-6.25,6.25,(i+1)/21),x=(a+b)/2;
    const y=bridgeDeck(x+bridgeX);
    const slope=Math.atan2(bridgeDeck(b+bridgeX)-bridgeDeck(a+bridgeX),b-a);
    for(let j=0;j<5;j++){
      box(bridge,pick(cobbleMats),x+range(-.041,.041),y-.012,(j-2)*.48+range(-.06,.06),range(.49,.56),.095,range(.42,.48),0,0,slope);
    }
    for(const side of [-1,1]){
      const z=side*1.31;
      for(let row=0;row<2;row++){
        const cx=x+(row===1?.145:-.025);
        box(bridge,pick(stones),cx,bridgeDeck(cx+bridgeX)+.14+row*.25,z,.574,.264,.30,0,0,slope);
      }
      box(bridge,pick(stones),x+.04,y+.56,z,.61,.14,.40,0,0,slope);
    }
  }
  for(const side of [-1,1]){
    for(let i=0;i<13;i++){
      const a=range(-.025,.025)+PI*(i+.5)/13;
      const x=4.22*cos(a),y=-1.03+2.35*sin(a);
      const length=range(.30,.44);
      box(bridge,pick(stones),x+cos(a)*.13,y+sin(a)*.14,side*1.372,.40,length,.20,0,0,a-PI/2);
    }
    for(const x of [-6.18,6.18]){
      const h=bridgeDeck(bridgeX+x);
      box(bridge,pick(stones),x,h+.30,side*1.33,.45,.72,.51);
      box(bridge,pick(stones),x,h+.69,side*1.33,.61,.14,.63);
    }
  }

  const wellX=-7.5,wellZ=3.30;
  const well=group(village,wellX,height(wellX,wellZ)+.025,wellZ,.18);
  const darkWater=mat(0x246b64,{roughness:.33,metalness:.24});
  piece(well,cylinder,darkWater,0,.25,0,1.60,.10,1.60);
  for(let row=0;row<3;row++){
    for(let i=0;i<13;i++){
      const a=(i+row*.48)*TAU/13,r=row===0?1.01:.96;
      box(well,pick(stones),sin(a)*r,.12+row*.24,cos(a)*r,.45,.24,.26,0,a);
    }
  }
  for(let i=0;i<13;i++){
    const a=i*TAU/13;
    box(well,pick(stones),sin(a)*.97,.75,cos(a)*.97,.48,.16,.39,0,a);
  }
  for(const x of [-.88,.88]){
    box(well,timber,x,1.29,0,.155,2.56,.16);
    beam(well,oak,[x,1.72,0],[x,2.44,.61],.10,.105);
    beam(well,oak,[x,1.72,0],[x,2.44,-.61],.10,.105);
  }
  tube(well,oak,[-.97,1.44,0],[1.04,1.44,0],.18);
  beam(well,iron,[1.01,1.44,0],[1.01,1.22,.21],.063);
  beam(well,oak,[1.01,1.22,.21],[1.22,1.22,.21],.092);
  beam(well,linen,[0,1.49,.10],[.03,.83,.12],.037,.037,false);
  piece(well,taper,oak,.03,.76,.12,.33,.22,.33,PI);
  const wellRoof=group(well,0,0,0,PI/2);
  gableRoof(wellRoof,1.57,2.24,2.40,.63,timber,roofMats[0],0,false);

  // Market awnings and small objects.
  function barrel(g,x,y,z,s=1,angle=0) {
    const a=group(g,x,y,z,angle);
    piece(a,taper,oak,0,.25*s,0,.70*s,.49*s,.70*s,PI);
    piece(a,taper,oak,0,.58*s,0,.70*s,.26*s,.70*s);
    piece(a,cylinder,endwood,0,.717*s,0,.48*s,.035*s,.48*s);
    for(const j of [.115,.52,.665]) piece(a,cylinder,iron,0,j*s,0,(j===.52?.704:.56)*s,.045*s,(j===.52?.704:.56)*s);
  }
  function crate(g,x,y,z,s=1,angle=0) {
    const a=group(g,x,y,z,angle);
    box(a,timber,0,.17*s,0,.56*s,.34*s,.47*s);
    for(const sign of [-1,1]){
      for(const yy of [.09,.27]) box(a,oak,0,yy*s,sign*.242*s,.58*s,.095*s,.051*s);
      for(const xx of [-.26,.26]) box(a,endwood,xx*s,.17*s,sign*.27*s,.056*s,.37*s,.045*s);
    }
  }
  const appleMats=[0xc85c3d,0xd9a747,0xa7aa58,0xe9c17d].map(c=>mat(c));
  const signRed=mat(0x823b33);
  function stall(x,z,angle,i) {
    const g=group(village,x,height(x,z)+.045,z,angle);
    const w=2.50,d=1.61;
    buildingLots.push([x,z,1.74]);
    for(const xx of [-1,1]) for(const zz of [-.61,.61]) box(g,oak,xx,1.03,zz,.10,2.04,.105);
    box(g,timber,0,.58,0,2.16,.70,1.31);
    for(let j=0;j<7;j++) box(g,oak,(j-3)*.303,.58,.67,.269,.64,.065);
    box(g,endwood,0,1.00,0,2.26,.15,1.44);
    beam(g,oak,[-1.28,2.13,.86],[1.28,2.13,.86],.073);
    beam(g,oak,[-1.28,2.38,-.72],[1.28,2.38,-.72],.073);
    for(let j=0;j<9;j++){
      const a=(j/9-.5)*w,b=((j+1)/9-.5)*w;
      const stripe=j%2?linen:cloth[i%cloth.length];
      const xyz=[],ids=[];
      for(let k=0;k<=8;k++){
        const t=k/8,y=2.37+.27*sin(t*PI)-.27*t,z=-d*.50+t*d;
        xyz.push(a,y,z,b,y,z);
        if(k<8){const l=k*2;ids.push(l,l+2,l+1,l+1,l+2,l+3);}
      }
      surface(g,xyz,ids,stripe,null,null,true);
      const y0=2.10,z0=.815,m=(a+b)/2;
      surface(g,[a,y0,z0,b,y0,z0,b,y0-.15,z0+.014,m,y0-.21,z0+.024,a,y0-.15,z0+.014],[0,1,3,1,2,3,0,3,4],stripe,null,null,true);
    }
    for(let j=0;j<3;j++){
      const xx=(j-1)*.64;
      box(g,oak,xx,1.11,.14,.50,.105,.50);
      for(let k=0;k<8;k++){
        const s=range(.063,.102);
        piece(g,ico,appleMats[(i+j)%appleMats.length],xx+range(-.19,.19),1.16+s,.14+range(-.19,.19),s,s,s,0,0,0,false);
      }
    }
    crate(g,1.46,0,.05,.75,.36);barrel(g,-1.39,0,-.42,.66);
  }
  stall(-10.45,7.44,-.14,0);
  stall(-7.30,7.88,.04,1);
  stall(-4.05,6.40,.39,2);
  stall(-12.45,4.68,1.25,3);

  function wheel(g,x,y,z,s=1) {
    piece(g,wheelGeometry,iron,x,y,z,s,s,s);
    for(let i=0;i<8;i++){
      const a=i*TAU/8;
      beam(g,oak,[x,y,z],[x+cos(a)*.46*s,y+sin(a)*.46*s,z],.067*s);
    }
    piece(g,cylinder,endwood,x,y,z,.24*s,.19*s,.24*s,PI/2);
  }
  function cart(x,z,angle,i) {
    const g=group(village,x,height(x,z),z,angle);
    for(const zz of [-.63,.63]) wheel(g,0,.52,zz,1.0);
    tube(g,iron,[0,.51,-.76],[0,.51,.76],.12);
    box(g,oak,0,.63,0,1.58,.13,1.0);
    for(const zz of [-.47,.47]){
      box(g,timber,0,.85,zz,1.54,.35,.10);
      box(g,endwood,0,1.02,zz,1.64,.08,.12);
      beam(g,oak,[.45,.63,zz],[1.84,.40,zz*.83],.095);
    }
    if(i) barrel(g,-.27,.69,0,.62,.2);
    else crate(g,-.22,.70,.04,1.12,.21);
    buildingLots.push([x,z,.94]);
  }
  cart(-13.95,9.2,.64,0);
  cart(16.8,6.23,-.78,1);
  for(const [x,z,s] of [[-18.2,9.1,1],[-17.7,9.3,.75],[-1.5,12.4,.78],[-5.3,-2.0,.72],[-19.8,-1.95,.89],[22.8,8.5,.89],[21.5,-10.4,1.05],[-22.75,16.4,.76]]){
    barrel(village,x,height(x,z),z,s,range(0,TAU));
  }
  for(const [x,z] of [[-16.0,5.4],[-6.3,14.0],[-13.8,6.3],[4.5,-8],[-22.1,-2.38],[18.0,12.75]]) crate(village,x,height(x,z),z,.95,range(0,TAU));

  function fence(points,step=1.13) {
    for(let p=0;p<points.length-1;p++){
      const [x,z]=points[p],[xx,zz]=points[p+1];
      const n=Math.ceil(Math.hypot(xx-x,zz-z)/step);
      let a;
      for(let i=0;i<=n;i++){
        const sx=mix(x,xx,i/n),sz=mix(z,zz,i/n),sy=height(sx,sz);
        const b=[sx,sy,sz];
        if(i>0||p===0) {
          const h=range(.81,1.07);
          box(village,timber,sx,sy+h*.47,sz,.145,h,.145,0,range(-.2,.2),range(-.05,.05));
          box(village,oak,sx,sy+h-.04,sz,.16,.14,.16,0,.43,.12);
        }
        if(a) for(const y of [.34,.67]) beam(village,oak,[a[0],a[1]+y,a[2]],[b[0],b[1]+y+range(-.04,.04),b[2]],.102,.105);
        a=b;
      }
    }
  }
  fence([[-25.1,14.4],[-22.7,17.1],[-19.4,17.85],[-19.0,15.66]]);
  fence([[-9.4,19.25],[-6.7,19.7],[-6.25,18.75]]);
  fence([[.1,20.0],[4.4,19.4],[4.65,16.4]]);
  fence([[-22.5,-8.6],[-22.6,-11.9],[-21.4,-14.2]]);
  fence([[-12.6,-17.25],[-10.2,-19.45],[-6.3,-19.8]]);
  fence([[22.0,12.24],[19.65,13.72],[18.9,17.3],[20.75,19.28]]);
  fence([[24.85,12.65],[26.95,12.7],[27.4,9.3]]);
  fence([[18.9,-9.2],[17.1,-10.7],[17.3,-13.1]]);
  fence([[2.4,-1.0],[4.95,-.70],[6.65,.50]]);
  fence([[4.1,6.9],[4.3,8.65],[5.55,9.36]]);
  function signpost(x,z,angle) {
    const g=group(village,x,height(x,z),z,angle);
    box(g,timber,0,.77,0,.12,1.54,.12);
    box(g,oak,.27,1.23,0,.77,.24,.09,0,0,.065);
    box(g,signRed,.25,1.23,.054,.46,.043,.025,0,0,.065);
    box(g,oak,-.22,1.01,0,.60,.20,.09,0,0,-.10);
  }
  signpost(-14.5,2.15,.32);signpost(17.72,1.86,-.46);signpost(-12.3,-8.88,.58);
  for(let i=0;i<9;i++){
    const x=-20.43+(i%3)*.62,z=-17.7+Math.floor(i/3)*.72;
    const g=group(village,x,height(x,z),z,range(-.18,.18));
    box(g,pick(stones),0,.09,0,.48,.17,.55);
    piece(g,pebble,pick(stones),0,.35,-.12,.18,range(.27,.43),.10,0,0,0);
  }
  // Planting, gardens, the cut banks, and the wooded ridge behind the village.
  const plants=group(scene);
  const treeLots=[];
  function tree(x,z,s,style=0,palette=2) {
    const g=group(plants,x,height(x,z)-.02,z,range(0,TAU));
    treeLots.push([x,z,s*.26]);
    tube(g,timber,[0,0,0],[.15*s,2.41*s,0],.31*s,.31*s,taper);
    if(style===1){
      for(let j=0;j<4;j++){
        const w=s*(2.12-j*.37),h=s*(1.78-j*.15);
        piece(g,cone,foliage[8+(j%2)],0,s*(1.40+j*.70),0,w,h,w,0,j*.21);
      }
      return;
    }
    const lobes=[
      [-.77,2.33,-.27,.91,1.03,.79],[.66,2.38,.22,.89,.94,.84],
      [-.09,2.56,.73,.94,1.00,.74],[.16,2.67,-.70,.91,.91,.78],
      [.09,3.18,.03,1.11,1.16,.99],[-.48,3.14,-.20,.78,.81,.82],
      [.53,3.13,-.18,.79,.76,.79],[-.10,3.66,-.08,.70,.81,.69]
    ];
    for(let i=0;i<lobes.length;i++){
      const [px,py,pz,sx,sy,sz]=lobes[i];
      const stretch=style===2?1.18:1.0,spread=style===2?.76:1.0;
      const p=[px*s*spread,py*s*stretch,pz*s*spread];
      if(i<4) tube(g,oak,[.02*s,1.2*s,0],[p[0]*.9,p[1]*.96,p[2]*.9],.16*s,.16*s,taper);
      const shade=clamp(palette+(i===4||i===7?1:random()<.34?-1:0),0,foliage.length-1);
      piece(g,ico,foliage[shade],...p,sx*s*spread*range(.91,1.08),sy*s*stretch,sz*s*spread,range(-.4,.4),range(0,TAU),range(-.4,.4));
    }
  }
  const planted=[
    [-25.5,17.1,1.26,0,5],[-20.8,19.7,.85,0,3],[-15.5,20.25,.78,2,4],[-10.2,19.9,.83,0,4],
    [4.7,16.85,1.08,0,5],[2.5,20.35,.67,2,4],[-26.1,8.7,.91,2,5],[-25.7,5.55,.81,0,3],
    [-25.3,-8.55,.95,0,5],[-21.2,-7.7,1.07,0,3],[-15.0,-5.84,.78,2,4],[-14.5,-15.5,.88,2,5],
    [-15.4,-18.45,1.28,0,6],[-19.6,-19.7,1.06,1],[-23.1,-18.1,1.06,1],[-23.9,-15.6,1.15,0,5],
    [-21.8,-16.9,.93,1],[-24.3,-12.65,.83,2,3],[-12.5,-19.05,.92,0,4],[-10.05,-19.8,1.09,1],
    [-7.6,-19.6,.93,1],[-3.85,-19.96,1.18,1],[-1.0,-20.45,.86,1],[2.7,-18.9,1.24,0,5],
    [3.7,-15.5,.86,2,4],[4.65,-3.95,.82,2,4],[2.85,.04,.74,0,4],
    [15.75,17.3,.9,0,4],[19.0,18.15,1.01,0,6],[23.7,16.4,.80,0,4],[26.0,14.75,.84,0,5],
    [25.3,19.3,1.04,0,5],[26.7,10.7,.70,2,3],[27.1,-.8,.84,2,5],[25.6,-7.3,.81,2,4],
    [27,-12.25,1.22,0,5],[24.7,-15.5,.94,1],[27,-16.5,1.25,1],[21.4,-18.15,1.06,1],
    [19.3,-16.9,.91,0,5],[16.7,-19.25,1.03,1],[15.1,-14.3,.87,2,3]
  ];
  planted.forEach(args=>tree(...args));
  const nearRoad=(x,z)=>roadSamples.some(([a,b,w])=>(x-a)**2+(z-b)**2<w*w) ||
    ((x+8.55)/5.95)**2+((z-2.9)/4.35)**2<1 || ((x+8.6)/4.85)**2+((z-7.3)/3.1)**2<1;
  const nearBuilding=(x,z)=>buildingLots.some(([a,b,r])=>(x-a)**2+(z-b)**2<r*r);
  const gardens=[[-14.2,19.44,3.25,2.12,.17],[-22.9,-10.7,3.18,3.25,-.16],[24.3,14.45,2.65,2.15,.27]];
  const soilRow=mat(0x826043,{map:dust,bumpMap:dust,bumpScale:.06});
  const cropMats=[0xa7a05a,0xc4a152,0xd3b66d].map(c=>mat(c));
  for(let k=0;k<gardens.length;k++){
    const [x,z,w,d,a]=gardens[k];
    const g=group(plants,x,height(x,z)-.09,z,a);
    for(let i=0;i<6;i++){
      const xx=(i/5-.5)*w*.88;
      box(g,soilRow,xx,.072,0,w*.136,.18,d);
      for(let j=0;j<9;j++){
        const zz=(j/8-.5)*d*.91+range(-.048,.048);
        if(k===2){
          piece(g,ico,pick(moss),xx,.21,zz,.15,.11,.16);
          if(random()<.47) piece(g,sphere,appleMats[1],xx+.065,.19,zz+.06,.12,.094,.11);
        }else{
          const h=range(.18,.39);
          beam(g,cropMats[0],[xx,.14,zz],[xx+range(-.055,.055),.14+h,zz],.034,.034,false);
          piece(g,ico,pick(cropMats),xx,.17+h,zz,.052,.097,.057,0,0,0,false);
        }
      }
    }
  }

  const blades = new T.BufferGeometry();
  blades.setAttribute('position',new T.Float32BufferAttribute([
    -.14,0,.10,.04,0,.085,-.10,1,.07,
    .025,0,.10,.15,0,.11,.30,.65,-.06,
    -.05,0,-.15,.08,0,-.22,.10,.73,-.39
  ],3));blades.computeVertexNormals();
  const herbMats=[0x778043,0x95934c,0x9e9c59,0x738245,0xb5a563].map(c=>mat(c,{side:T.DoubleSide}));
  for(let i=0;i<2300;i++){
    const z=range(-21.9,21.9),x=range(-extent(z)+.14,extent(z)-.14);
    if(bankDist(x,z)<.42||nearRoad(x,z)||nearBuilding(x,z)) continue;
    if(gardens.some(([a,b,w,d])=>abs(x-a)<w*.6&&abs(z-b)<d*.6)) continue;
    const h=height(x,z);
    const size=range(.42,1.23);
    piece(plants,blades,pick(herbMats),x,h-.025,z,size,range(.13,.31),size,0,range(0,TAU),0,false);
    if(i%11===0){
      const m=pick(flowerMats);
      for(let j=0;j<4;j++){
        const dx=range(-.24,.24),dz=range(-.24,.24),y=range(.11,.24);
        const yy=height(x+dx,z+dz);
        piece(plants,blades,herbMats[0],x+dx,yy,z+dz,.41,y,.41,0,range(0,TAU),0,false);
        piece(plants,ico,m,x+dx,yy+y,z+dz,.052,.041,.056,0,0,0,false);
      }
    }
  }
  for(let i=0;i<270;i++){
    const z=range(-21.8,21.8),side=i%2?1:-1,offset=range(.08,1.14),x=bank(z,side)+offset*side;
    if(abs(z-bridgeZ)<2.15) continue;
    const y=height(x,z);
    const s=range(.12,.42);
    if(i%3===0){
      const h=range(.18,.64);
      piece(plants,blades,pick(herbMats),x,y-.024,z,1.10,h,.97,0,range(0,TAU),0,false);
      piece(plants,blades,herbMats[0],x+.07,y-.029,z+.11,.74,h*.86,.85,0,range(0,TAU),0,false);
    } else {
      piece(plants,pebble,pick(stones),x,y-.029,z,s*range(1,1.55),s*.55,s,range(-.2,.2),range(0,TAU),0);
    }
  }
  for(let i=0;i<134;i++){
    const [ex,ez]=outline[Math.floor(random()*outline.length)];
    if(bankDist(ex,ez)<.23) continue;
    const x=ex*range(.982,1.01),z=ez*range(.982,1.01),y=height(x,z);
    const r=range(.14,.57);
    piece(plants,pebble,pick(stones),x,y-range(.07,.35),z,r*range(1.1,1.6),r*.63,r,.08,range(0,TAU),.07);
    if(i%4===0) piece(plants,ico,pick(moss),x*.99,y+.075,z*.989,r*.91,r*.40,r*.82,0,0,0);
    if(i%7===0) piece(plants,pebble,pick(stones),x*1.01,y-range(1.05,2.7),z*1.01,r*1.27,r*.73,r*.77,0,range(0,TAU),0);
  }
  for(let i=0;i<210;i++){
    const z=range(-21.1,21.1),x=range(-extent(z)+.7,extent(z)-.7);
    if(nearRoad(x,z)||nearBuilding(x,z)||bankDist(x,z)<.8||treeLots.some(([a,b,r])=>Math.hypot(x-a,z-b)<r)) continue;
    const s=range(.16,.46),y=height(x,z);
    piece(plants,ico,pick(moss),x,y+s*.41,z,s*1.3,s*.69,s,range(-.5,.5),range(0,TAU),0);
    if(random()<.50) piece(plants,ico,pick(moss),x+.19,y+s*.4,z+.11,s*.82,s*.60,s*.81,0,0,0);
  }

  const lamps=[];
  const lanternMats=Array.from({length:6},()=>mat(0x645440,{emissive:0xffa24b,emissiveIntensity:0}));
  function lamp(x,z,i) {
    const y=height(x,z),g=group(village,x,y,z,range(-.22,.22));
    box(g,pick(stones),0,.10,0,.38,.23,.38);
    piece(g,taper,timber,0,1.05,0,.17,2.08,.17);
    beam(g,iron,[0,2.03,0],[0,2.03,.34],.084);
    beam(g,iron,[0,1.78,0],[0,2.04,.29],.051);
    box(g,lanternMats[i%lanternMats.length],0,1.78,.33,.24,.35,.24);
    for(const a of [-.12,.12]) for(const b of [-.12,.12]) box(g,iron,a,1.79,.33+b,.038,.38,.038);
    box(g,iron,0,1.594,.33,.29,.070,.29);
    piece(g,cone,iron,0,2.002,.33,.40,.18,.40,0,PI/4);
    const halo=new T.Sprite(new T.SpriteMaterial({map:haloMap,transparent:true,opacity:0,depthWrite:false,color:0xffcc89,blending:T.AdditiveBlending}));
    halo.position.set(x,y+1.79,z+.35);halo.scale.set(1.65,1.65,1);scene.add(halo);
    const patch=new T.Mesh(new T.PlaneGeometry(2.7,2.7),new T.MeshBasicMaterial({map:haloMap,transparent:true,depthWrite:false,opacity:0,color:0xffa74a,blending:T.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-2}));
    patch.rotation.x=-PI/2;patch.position.set(x,y+.07,z+.32);scene.add(patch);
    lamps.push({halo,patch});
  }
  [[-23.9,2.93],[-16.02,1.66],[-11.7,2.17],[-4.03,3.1],[westBridge-.45,5.0],[eastBridge+.49,4.94],
   [22.9,4.48],[-14.1,-8.18],[-9.12,9.25],[21.3,-8.57],[-11.13,13.36]].forEach(([x,z],i)=>lamp(x,z,i));

  // A handful of tiny figures follow their own routes through the village.
  const tunics=[0x85433a,0x3c6765,0xb68743,0x6a5f78,0x676f47,0xa95a3f,0x5d6d8c,0x88816b].map(c=>mat(c));
  const skin=[0xc99168,0xe4b391,0x9d6d50,0xdca385].map(c=>mat(c));
  const hat=mat(0xa6844d);
  const walking=[];
  function villager(points,speed,offset,index) {
    const route=new T.CatmullRomCurve3(points.map(([x,z])=>v(x,0,z)));
    route.arcLengthDivisions=260;route.updateArcLengths();
    const g=live(scene);
    const body=group(g);
    const top=tunics[index%tunics.length], face=skin[index%skin.length];
    const s=range(.89,1.09);
    g.scale.setScalar(s);
    piece(body,taper,top,0,.74,0,.40,.54,.32,PI);
    piece(body,sphere,face,0,1.13,.028,.148,.165,.141);
    piece(body,sphere,face,0,1.127,.147,.041,.048,.051);
    if(index%3!==1){
      piece(body,cylinder,hat,0,1.24,.027,.39,.055,.34);
      piece(body,taper,hat,0,1.31,.022,.274,.145,.255);
    }else{
      piece(body,sphere,timber,0,1.185,-.007,.155,.143,.145);
      piece(body,sphere,face,0,1.13,.074,.127,.132,.113);
    }
    box(body,oak,0,.595,0,.36,.057,.34);
    const legs=[],arms=[];
    for(const dir of [-1,1]){
      const leg=group(body,dir*.104,.525,0);
      box(leg,timber,0,-.19,0,.137,.405,.145);
      box(leg,dark,0,-.43,.049,.14,.12,.224);
      legs.push(leg);
      const arm=group(body,dir*.205,.90,0);
      arm.rotation.z=dir*.14;
      box(arm,top,0,-.125,0,.112,.27,.126);
      piece(arm,sphere,face,0,-.27,.017,.058,.074,.060);
      arms.push(arm);
    }
    if(index===3||index===6){
      const satchel=group(body,.16,.57,-.09);
      box(satchel,oak,0,0,0,.25,.24,.17);
      box(satchel,endwood,0,.07,.035,.25,.104,.13);
    }
    walking.push({g,body,arms,legs,route,length:route.getLength(),speed,offset,index});
  }
  const thoroughfare=[...mainWest,...mainEast];
  villager(thoroughfare,1.62,.23,0);
  villager(thoroughfare.map(([x,z])=>[x,z+.59]),1.42,1.32,1);
  villager(thoroughfare.map(([x,z])=>[x,z-.52]),1.27,.73,2);
  villager([[-17.7,-11.95],[-15.8,-10.55],[-12.85,-7.95],[-12.70,-3.1],[-13.9,-.23],[-11.5,1.73],[-11.78,5.82],[-12.0,9.69],[-11.68,15.6]],1.39,.33,3);
  villager([[-4.6,18.7],[-4.8,13],[-3.0,8.8],[-2.7,5.3],[-3.1,2.6],[-4.32,.82],[-3.65,-1.8],[-4.83,-7.6],[-4.74,-12.7],[-5.35,-18.8]],1.48,.71,4);
  villager([[21.35,-10.6],[22.7,-7.87],[20.55,-3.98],[18.4,-.46],[18.1,2.9],[21.55,3.25],[23,6.6],[23.53,10.5],[21.9,16.72]],1.41,.48,5);
  villager([[-13.0,9.7],[-12.2,9.8],[-8.3,9.82],[-5.0,9.23],[-3.01,8.7],[-2.53,5.58],[-3.53,2.62],[-5.6,1.15],[-9.0,1.03],[-11.48,2.8]],1.25,1.52,6);
  villager([[-26.0,2.7],[-21.8,1.6],[-16.0,.72],[-13.7,.31],[-12.75,-3.4],[-12.8,-6.92]],1.27,1.09,7);

  const smoke=[];
  for(const p of chimneys){
    for(let j=0;j<5;j++){
      const material=new T.SpriteMaterial({map:vaporMap,transparent:true,color:0xead8cc,opacity:0,depthWrite:false});
      const puff=new T.Sprite(material);scene.add(puff);
      smoke.push({p,puff,offset:j/5+range(-.04,.04),size:range(.76,1.21),phase:range(0,TAU),speed:range(.072,.095)});
    }
  }
  const clouds=[];
  for(const [x,y,z,s,angle] of [[-27,13.3,-29,1.05,.12],[-1,16.8,-36,.92,.10],[24,14.0,-30,.91,-.07],[39,12.6,-14,.86,.05],[-37,12.8,-5,.65,.12]]){
    const g=group(scene,x,y,z);
    for(let j=0;j<6;j++){
      const sprite=new T.Sprite(new T.SpriteMaterial({map:vaporMap,color:0xffeee0,opacity:range(.18,.29),transparent:true,depthWrite:false,rotation:angle}));
      sprite.position.set(j*1.78-4.45,range(-.48,.7),range(-.5,.5));
      sprite.scale.set(range(5.7,8.5)*s,range(1.8,3.2)*s,1);
      g.add(sprite);
    }
    clouds.push({g,x,y,z,phase:range(0,TAU)});
  }
  const birdM=mat(0x45392f,{side:T.DoubleSide,roughness:1});
  const birds=[];
  for(let i=0;i<6;i++){
    const g=live(scene);
    const s=range(.84,1.29);g.scale.setScalar(s);
    piece(g,ico,birdM,0,0,0,.079,.07,.225,0,0,0,false);
    piece(g,ico,birdM,0,.036,.17,.062,.060,.074,0,0,0,false);
    const wings=[];
    for(const side of [-1,1]){
      const wing=group(g,side*.04,0,0);
      surface(wing,[0,0,.10,side*.23,.04,.091,side*.54,.032,-.10,side*.35,-.02,-.135,side*.10,0,-.11,0,0,-.067],[0,1,4,1,2,3,1,3,4,0,4,5],birdM);
      wings.push(wing);
    }
    birds.push({g,wings,phase:i*.24,s:range(.7,1.3)});
  }

  // Continue the village lanes and the wooded banks beyond the miniature base.
  road([[-57, 6.8], [-46, 5.1], [-36, 1.0], [-26.5, 2.8]], 1.65, 14);
  road([[26.7, 2.45], [34, 3.2], [43, 5.8], [55, 2.1]], 1.55, 12);
  fence([[28.5, 12.8], [34.5, 13.5], [40, 13.0]]);
  fence([[-30, 11.0], [-34.2, 13.5], [-39, 14.8]]);
  for (let z = -64; z <= 29; z += 5.1) {
    for (let x = -61; x <= 61; x += 5.3) {
      const treeX = x + range(-1.9, 1.9);
      const treeZ = z + range(-1.9, 1.9);
      const grove = .54 + .18 * sin(treeX * .24 + treeZ * .12) + .15 * cos(treeZ * .31);
      if (abs(treeX) <= 28 && treeZ > -23 && treeZ < 23) continue;
      if (bankDist(treeX, treeZ) < 1.4 || nearRoad(treeX, treeZ) || random() > grove) continue;
      tree(treeX, treeZ, range(.58, 1.22), random() < .56 ? 1 : 0, pick([2, 3, 4, 5]));
    }
  }
  [[-32, -3.2, 1.20, 0, 5], [-30, 7.6, .88, 2, 4], [30, -8, 1.21, 0, 5],
   [35, -12.7, .97, 1, 3], [34, 9.3, .90, 0, 4]].forEach(args => tree(...args));
  flush();
  const sunset = new T.Color(0xffc68a),moonlight=new T.Color(0xf5a783);
  const skyWarm = new T.Color(0xffefd4),skyBlue=new T.Color(0xaebaf1);
  const fogWarm=new T.Color(0xe8c6a5),fogNight=new T.Color(0x8f859e);
  const vaporWarm=new T.Color(0xf5e0c9),vaporNight=new T.Color(0xb3adbf);
  function lighting() {
    const dusk=smooth(.05,.99,solar);
    sun.intensity=mix(2.75,.53,dusk);sun.color.copy(sunset).lerp(moonlight,dusk);
    sky.intensity=mix(1.73,1.03,dusk);sky.color.copy(skyWarm).lerp(skyBlue,dusk);
    fill.intensity=mix(.52,.76,dusk);scene.fog.color.copy(fogWarm).lerp(fogNight,dusk);
    waterDusk.value=dusk;
    windowMats.forEach((m,i)=>{
      const start=.12+(i*.073);
      m.emissiveIntensity=mix(.018,2.40,smooth(start,start+.32,solar));
    });
    lanternMats.forEach((m,i)=>{
      const start=.22+(i*.074);
      m.emissiveIntensity=mix(.010,3.4,smooth(start,start+.27,solar));
    });
    lamps.forEach(({halo,patch},i)=>{
      const start=.22+((i%lanternMats.length)*.074),lit=smooth(start,start+.27,solar);
      halo.material.opacity=lit*.56;
      patch.material.opacity=lit*.19;
    });
    for(const {puff} of smoke) puff.material.color.copy(vaporWarm).lerp(vaporNight,dusk);
  }
  const tangent=v(0,0,0),point=v(0,0,0);
  function animateWorld(t) {
    waterUniform.value=t;
    sails.rotation.z=.36-t*.36;
    for(const a of walking){
      const s=(a.offset+t*a.speed/a.length)%2;
      const u=s>1?2-s:s;
      a.route.getPointAt(u,point);
      a.route.getTangentAt(u,tangent);
      const direction=s>1?-1:1;
      const onBridge=abs(point.z-bridgeZ)<1.17&&point.x>westBridge&&point.x<eastBridge;
      const y=onBridge?bridgeDeck(point.x)+.065:height(point.x,point.z)+.053;
      const swing=t*7.6+a.index*1.19;
      a.g.position.set(point.x,y,point.z);
      a.g.rotation.y=Math.atan2(tangent.x*direction,tangent.z*direction);
      a.body.position.y=.043*(1-cos(swing*2));
      for(let j=0;j<2;j++){
        const angle=sin(swing+(j?PI:0))*.43;
        a.legs[j].rotation.x=angle;a.arms[j].rotation.x=-angle*.63;
      }
    }
    for(const {p,puff,offset,size,phase,speed} of smoke){
      const u=(t*speed+offset+1)%1;
      const spread=(.48+u*2.35)*size;
      puff.scale.set(spread*(1+u*.48),spread*.91,1);
      puff.position.set(p.x+u*(1.53+.27*sin(t*.41+phase)),p.y+u*3.25,
        p.z-u*1.05+u*.24*cos(t*.42+phase));
      puff.material.opacity=.40*smooth(0,.15,u)*(1-smooth(.37,1,u));
    }
    for(const {g,x,y,z,phase} of clouds){
      g.position.set(x+sin(t*.026+phase)*4.4,y+cos(t*.085+phase)*.37,z+cos(t*.028+phase)*1.25);
    }
    for(const {g,wings,phase,s} of birds){
      const a=.24+t*.093+phase;
      g.position.set(1+sin(a)*23,11.9+sin(a*1.67)*2.25+phase*.59,-8+cos(a)*15);
      g.rotation.y=Math.atan2(cos(a)*23,-sin(a)*15);
      g.rotation.z=.17*sin(a);
      const flap=.70*sin(t*7.25*s+phase*7)+.13;
      wings[0].rotation.z=flap;wings[1].rotation.z=-flap;
    }
  }


  const target = new T.Vector3();
  const cameraOffset = new T.Vector3();
  const skyBackground = new T.Color();
  const warmSky = new T.Color(0xf5dfb9);
  const coolSky = new T.Color(0x626f8e);
  const views = [
    { level: 0, x: -9.5, y: 6.2, z: -0.5, yaw: .34, pitch: .40, halfHeight: 9.6, light: .97 },
    { level: .4, x: 2.8, y: 5.65, z: -1.5, yaw: .17, pitch: .39, halfHeight: 9.8, light: .52 },
    { level: 1, x: 13.5, y: 5.25, z: -3.5, yaw: -.15, pitch: .37, halfHeight: 9.35, light: .06 },
  ];
  let solar = .52;
  let lastLight = -1;
  let renderWidth = 0;
  let renderHeight = 0;
  let lastProjection = 0;
  let lastShadowUpdate = -Infinity;

  function render(textureWidth, textureHeight, apertureHeight, level, time) {
    const lower = level < .4 ? views[0] : views[1];
    const upper = level < .4 ? views[1] : views[2];
    const amount = smooth(lower.level, upper.level, level);
    const between = key => mix(lower[key], upper[key], amount);
    const drift = sin(time * .30);
    const yaw = between('yaw') + .038 * drift;
    const pitch = between('pitch');
    target.set(between('x') + .56 * drift, between('y'), between('z'));
    cameraOffset.set(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch));
    camera.position.copy(cameraOffset).multiplyScalar(99).add(target);
    camera.lookAt(target);

    const projection = between('halfHeight') / apertureHeight;
    if (renderWidth !== textureWidth || renderHeight !== textureHeight) {
      renderWidth = textureWidth;
      renderHeight = textureHeight;
      renderer.setSize(renderWidth, renderHeight, false);
      lastProjection = 0;
    }
    if (lastProjection !== projection) {
      Object.assign(camera, { left: -renderWidth * projection, right: renderWidth * projection,
                              top: renderHeight * projection, bottom: -renderHeight * projection });
      camera.updateProjectionMatrix();
      lastProjection = projection;
    }
    solar = between('light');
    if (Math.abs(solar - lastLight) > .001) {
      lighting();
      skyBackground.copy(warmSky).lerp(coolSky, smooth(.08, .98, solar));
      scene.background = skyBackground;
      lastLight = solar;
    }
    animateWorld(time);
    if (time - lastShadowUpdate > .5 || time < lastShadowUpdate) {
      renderer.shadowMap.needsUpdate = true;
      lastShadowUpdate = time;
    }
    renderer.render(scene, camera);
    return renderer.domElement;
  }
  return { canvas: renderer.domElement, render };
}
