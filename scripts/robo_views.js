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
    console.log("🤖 Iniciando Robô com Proxy Invisível Anti-Bloqueio...");
    
    const { data: obras, error } = await supabase.from('obras').select('*').not('link_scan', 'is', null);
    if(error) { console.error("🚨 Erro no banco de dados:", error); return; }
    
    const hojeStr = new Date().toDateString();

    for(const obra of obras) {
        if(!obra.link_scan || !obra.link_scan.includes('http')) continue;
        
        try {
            console.log(`\n🔎 Tentando ler: ${obra.nome}`);
            
            // Usando proxy AllOrigins para driblar bloqueios + quebra de cache com Date.now()
            const linkComQuebraDeCache = obra.link_scan + (obra.link_scan.includes('?') ? '&' : '?') + 't=' + Date.now();
            const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(linkComQuebraDeCache);
            
            const res = await fetch(proxyUrl, { 
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                } 
            });
            
            const html = await res.text();
            
            // Verifica se o Cloudflare ou Firewall pegou a gente
            if(html.includes('Cloudflare') || html.includes('Just a moment...') || html.includes('Security check') || html.includes('DDoS protection')) {
                console.log(`❌ BLOQUEIO DETECTADO: O firewall do site ainda conseguiu bloquear o acesso.`);
                continue; 
            }

            const $ = cheerio.load(html);
            let textViews = '';

            // Caça as Views com alta precisão
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
                console.log(`👁️ Número original achado no site: "${textViews}" -> Convertido para: ${novasViews}`);
                
                let viewsOntemSalvar = obra.views_ontem || 0;
                if(obra.data_verificacao !== hojeStr) {
                    viewsOntemSalvar = obra.views_totais || 0;
                }
                
                await supabase.from('obras').update({ 
                    views_totais: novasViews, 
                    views_ontem: viewsOntemSalvar, 
                    data_verificacao: hojeStr 
                }).eq('id', obra.id);
                
                console.log(`✅ SUCESSO! Banco atualizado para ${novasViews} views.`);
            } else {
                console.log(`⚠️ FALHA: O site liberou o acesso, mas a div/palavra com as views mudou de lugar ou não existe.`);
                console.log(`   Recorte do HTML lido: ${html.substring(0, 150).replace(/\n/g, ' ')}...`);
            }
            
            await new Promise(r => setTimeout(r, 2000));
        } catch(e) {
            console.error(`🚨 Erro em ${obra.nome}:`, e.message);
        }
    }
    console.log("\n🏁 Sincronização finalizada.");
}

run();
