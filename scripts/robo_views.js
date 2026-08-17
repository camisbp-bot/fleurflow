const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');

const SUPABASE_URL = 'https://sqdgafisdbjotyzlhhsj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxZGdhZmlzZGJqb3R5emxoaHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NzMzMDgsImV4cCI6MjEwMTQ0OTMwOH0.H6tPKPFZ0XsuQed3vL2wLi5--nZyB17YQiZ2jd4Yvt0';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function parseViews(text) {
    if (!text) return 0;
    let limpo = String(text).toUpperCase().trim();
    if (!limpo.match(/[KMB]/)) {
        let numExato = parseInt(limpo.replace(/[^\d]/g, ''));
        if (!isNaN(numExato)) return numExato;
    }
    let match = limpo.match(/[\d\.,]+[KMB]?/);
    if (!match) return 0;

    let numStr = match[0]; let multiplicador = 1;
    if (numStr.includes('K')) multiplicador = 1000;
    if (numStr.includes('M')) multiplicador = 1000000;
    if (numStr.includes('B')) multiplicador = 1000000000;

    numStr = numStr.replace(/[KMB]/g, '');
    if (numStr.includes(',') && !numStr.includes('.')) numStr = numStr.replace(',', '.');
    else numStr = numStr.replace(/,/g, '');

    let numero = parseFloat(numStr);
    return isNaN(numero) ? 0 : Math.round(numero * multiplicador);
}

async function run() {
    console.log("🤖 Robô Matemático ativado: Calculando deltas (diferenças)...");
    
    const { data: obras, error } = await supabase.from('obras').select('*').not('link_scan', 'is', null);
    if(error) { console.error("🚨 Erro:", error); return; }
    
    const hojeStr = new Date().toDateString();

    for(const obra of obras) {
        if(!obra.link_scan || !obra.link_scan.includes('http')) continue;
        try {
            console.log(`\n🔎 Analisando: ${obra.nome}`);
            const urlRealTime = obra.link_scan + (obra.link_scan.includes('?') ? '&' : '?') + 'nocache=' + Date.now();

            const res = await fetch(urlRealTime, { 
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36',
                    'Cache-Control': 'no-cache', 'Pragma': 'no-cache'
                } 
            });
            const html = await res.text();
            if(html.includes('Cloudflare') || html.includes('Just a moment...')) continue; 

            const $ = cheerio.load(html);
            let textViews = $('meta[itemprop="interactionCount"]').attr('content') || $('meta[property="og:views"]').attr('content');
            
            if (!textViews) {
                $('i[class*="eye"]').each((i, el) => {
                    let pTxt = $(el).parent().text().replace(/\s+/g, ' ').trim();
                    if(pTxt.match(/[\d\.,]+[KMB]?/)) { textViews = pTxt; return false; }
                });
            }
            if (!textViews) textViews = $('.post-total-views').first().text() || $('.manga-info-views').first().text();

            const siteViews = parseViews(textViews); // Ex: 1.810.000
            
            if(siteViews > 0) {
                let viewsDiff = 0;
                let viewsTotaisApp = obra.views_totais || 0; // Ex: 2.222.383
                
                // Se já leu antes, calcula a diferença. Se for a primeira vez, apenas salva a base do site.
                if (obra.views_site_raw && siteViews > obra.views_site_raw) {
                    viewsDiff = siteViews - obra.views_site_raw; // 1.810.000 - 1.800.000 = 10.000
                }

                const novoTotalApp = viewsTotaisApp + viewsDiff; // 2.222.383 + 10.000 = 2.232.383

                let viewsOntemSalvar = obra.views_ontem || 0;
                if(obra.data_verificacao !== hojeStr) viewsOntemSalvar = obra.views_totais || 0;
                
                await supabase.from('obras').update({ 
                    views_site_raw: siteViews,  // Salva a leitura de agora pro futuro
                    views_totais: novoTotalApp, // O Novo total oficial
                    views_ontem: viewsOntemSalvar, 
                    data_verificacao: hojeStr 
                }).eq('id', obra.id);
                
                console.log(`✅ Aumento de +${viewsDiff} views! Total App agora é: ${novoTotalApp}`);
            }
            await new Promise(r => setTimeout(r, 2000));
        } catch(e) { console.error(`🚨 Erro em ${obra.nome}:`, e.message); }
    }
}
run();
