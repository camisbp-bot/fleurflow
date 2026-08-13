const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');

const SUPABASE_URL = 'https://sqdgafisdbjotyzlhhsj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxZGdhZmlzZGJqb3R5emxoaHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NzMzMDgsImV4cCI6MjEwMTQ0OTMwOH0.H6tPKPFZ0XsuQed3vL2wLi5--nZyB17YQiZ2jd4Yvt0';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function parseViews(text) {
    if (!text) return 0;
    let limpo = String(text).toUpperCase().trim();
    let match = limpo.match(/[\d\.,]+[KMB]?/);
    if (!match) return 0;

    let numStr = match[0];
    let multiplicador = 1;
    
    if (numStr.includes('K')) multiplicador = 1000;
    if (numStr.includes('M')) multiplicador = 1000000;
    if (numStr.includes('B')) multiplicador = 1000000000;

    numStr = numStr.replace(/[KMB]/g, '');
    if (numStr.includes(',') && !numStr.includes('.')) {
        numStr = numStr.replace(',', '.');
    } else {
        numStr = numStr.replace(/,/g, '');
    }

    let numero = parseFloat(numStr);
    return isNaN(numero) ? 0 : Math.round(numero * multiplicador);
}

async function run() {
    console.log("🤖 Iniciando Robô Ninja (Acesso Direto com Disfarce Perfeito)...");
    
    const { data: obras, error } = await supabase.from('obras').select('*').not('link_scan', 'is', null);
    if(error) { console.error("🚨 Erro no banco de dados:", error); return; }
    
    const hojeStr = new Date().toDateString();

    for(const obra of obras) {
        if(!obra.link_scan || !obra.link_scan.includes('http')) continue;
        
        try {
            console.log(`\n🔎 Lendo: ${obra.nome}`);
            
            // Acesso direto, mas simulando 100% um Google Chrome real vindo do Google
            const res = await fetch(obra.link_scan, { 
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Referer': 'https://www.google.com/',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
                    'Sec-Ch-Ua-Mobile': '?0',
                    'Sec-Ch-Ua-Platform': '"Windows"',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'cross-site',
                    'Sec-Fetch-User': '?1',
                    'Upgrade-Insecure-Requests': '1'
                } 
            });
            
            const html = await res.text();
            
            if(html.includes('Cloudflare') || html.includes('Just a moment...')) {
                console.log(`❌ BLOQUEIO: Cloudflare barrou o acesso.`);
                continue; 
            }

            const $ = cheerio.load(html);
            let textViews = '';

            // Caça as Views no tema Madara/MangaBooth
            textViews = $('.post-total-views .number').first().text() ||
                        $('.manga-info-views .number').first().text() ||
                        $('.post-views').first().text() ||
                        $('.view-count').first().text();

            if (!textViews) {
                const regex = /(\d+[\d,.]*)\s*(views|visualiza)/i;
                const match = html.match(regex);
                if (match) textViews = match[1];
            }

            const novasViews = parseViews(textViews);
            
            if(novasViews > 0) {
                console.log(`👁️ Encontrou: "${textViews}" -> Gravando: ${novasViews}`);
                
                let viewsOntemSalvar = obra.views_ontem || 0;
                if(obra.data_verificacao !== hojeStr) {
                    viewsOntemSalvar = obra.views_totais || 0;
                }
                
                await supabase.from('obras').update({ 
                    views_totais: novasViews, 
                    views_ontem: viewsOntemSalvar, 
                    data_verificacao: hojeStr 
                }).eq('id', obra.id);
                
                console.log(`✅ SUCESSO! Banco atualizado.`);
            } else {
                console.log(`⚠️ FALHA: Página carregou, mas a palavra com as views não foi achada.`);
                // Imprime um pedaço do HTML pra gente ver se a página real carregou mesmo
                console.log(`   HTML recebido (início): ${html.substring(0, 100).replace(/\n/g, ' ')}...`);
            }
            
            await new Promise(r => setTimeout(r, 2000));
        } catch(e) {
            console.error(`🚨 Erro de conexão em ${obra.nome}:`, e.message);
        }
    }
    console.log("\n🏁 Sincronização finalizada.");
}

run();
