const BASE_URL = 'https://argautos.com/api/v1';

async function testAlfaMito() {
  try {
    const brandsRes = await fetch(`${BASE_URL}/brands?per_page=100`);
    const brandsData = await brandsRes.json();
    const alfaBrand = brandsData.data.find(b => b.name.toLowerCase() === 'alfa romeo');

    if (!alfaBrand) return;

    const modelsRes = await fetch(`${BASE_URL}/brands/${alfaBrand.id}/models?per_page=100`);
    const modelsData = await modelsRes.json();
    const mitoModel = modelsData.data.find(m => m.name.toLowerCase() === 'mito');

    if (!mitoModel) return;

    const verRes = await fetch(`${BASE_URL}/models/${mitoModel.id}/versions?per_page=100`);
    const verData = await verRes.json();
    const firstVer = verData.data[0];

    if (!firstVer) return;

    const valRes = await fetch(`${BASE_URL}/versions/${firstVer.id}/valuations?currency=ars&sources=acara`);
    const valData = await valRes.json();
    console.log(JSON.stringify(valData, null, 2));

  } catch(e) {
    console.error(e);
  }
}

testAlfaMito();
