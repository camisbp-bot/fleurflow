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
    console.log("🤖 Robô de Views acionado (Busca Avançada)...");
    
    const { data: obras, error } = await supabase.from('obras').select('*').not('link_scan', 'is', null);
    if(error) { console.error("🚨 Erro:", error); return; }
    
    const hojeStr = new Date().toDateString();

    for(const obra of obras) {
        if(!obra.link_scan || !obra.link_scan.includes('http')) continue;
        
        try {
            const res = await fetch(obra.link_scan, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
            const html = await res.text();
            const $ = cheerio.load(html);
            
            let textViews = '';

            // Tenta achar pelo metadado padrão do WordPress/Madara
            textViews = $('.post-total-views .number, .manga-info-views .number, .post-views, input[name*="views"]').first().val() || 
                        $('.post-total-views, .manga-info-views, .post-views, .view-count').first().text();

            if (!textViews) {
                // Varredura por atributos de texto genéricos
                const regex = /(\d+[\d,.]*)\s*(views|visualiza)/i;
                const match = html.match(regex);
                if (match) textViews = match[1];
            }

            const novasViews = parseViews(textViews);
            
            if(novasViews > 0) {
                let viewsOntemSalvar = obra.views_ontem || 0;
                if(obra.data_verificacao !== hojeStr) {
                    viewsOntemSalvar = obra.views_totais || 0;
                }
                
                await supabase.from('obras').update({ 
                    views_totais: novasViews, 
                    views_ontem: viewsOntemSalvar, 
                    data_verificacao: hojeStr 
                }).eq('id', obra.id);
                
                console.log(`✅ ${obra.nome}: ${novasViews} views.`);
            }
            
            await new Promise(r => setTimeout(r, 2000));
        } catch(e) {
            console.error(`🚨 Erro em ${obra.nome}:`, e.message);
        }
    }
    console.log("🏁 Sincronização finalizada.");
}

run();
