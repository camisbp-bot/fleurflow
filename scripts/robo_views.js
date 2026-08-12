const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');

// Suas chaves de acesso
const SUPABASE_URL = 'https://sqdgafisdbjotyzlhhsj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxZGdhZmlzZGJqb3R5emxoaHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NzMzMDgsImV4cCI6MjEwMTQ0OTMwOH0.H6tPKPFZ0XsuQed3vL2wLi5--nZyB17YQiZ2jd4Yvt0';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Extrator Cirúrgico de Números
function parseViews(text) {
    if (!text) return 0;
    let limpo = text.toUpperCase().trim();
    
    // Captura apenas a primeira sequência que pareça número (ex: "1.7M", "1715010", "1,715,010")
    let match = limpo.match(/[\d\.,]+[KMB]?/);
    if (!match) return 0;

    let numStr = match[0];
    let multiplicador = 1;
    
    if (numStr.includes('K')) multiplicador = 1000;
    if (numStr.includes('M')) multiplicador = 1000000;
    if (numStr.includes('B')) multiplicador = 1000000000;

    numStr = numStr.replace(/[KMB]/g, '');

    // Resolve problema de formatação europeia (ex: 1,7M ou 1,715,010)
    if (numStr.includes(',') && !numStr.includes('.')) {
        numStr = numStr.replace(',', '.');
    } else {
        numStr = numStr.replace(/,/g, '');
    }

    let numero = parseFloat(numStr);
    return Math.round(numero * multiplicador);
}

async function run() {
    console.log("🤖 Acordando o Robô Sincronizador (Modo Cirúrgico)...");
    
    const { data: obras, error } = await supabase.from('obras').select('*').not('link_scan', 'is', null);
    if(error) { console.error("🚨 Erro no banco:", error); return; }
    
    const hojeStr = new Date().toDateString();

    for(const obra of obras) {
        if(!obra.link_scan || !obra.link_scan.includes('http')) continue;
        console.log(`🔎 Analisando: ${obra.nome}`);
        
        try {
            const res = await fetch(obra.link_scan, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
            const html = await res.text();
            const $ = cheerio.load(html);
            
            let textViews = '';

            // ESTRATÉGIA 1: Padrão Tema Madara (Busca o bloco que diz "View" ou "Visualizações")
            $('.post-content_item').each((i, el) => {
                const heading = $(el).find('.summary-heading').text().trim().toLowerCase();
                if (heading.includes('view') || heading.includes('visualiza')) {
                    textViews = $(el).find('.summary-content').text().trim();
                }
            });

            // ESTRATÉGIA 2: Busca por ícones de olho e classes de contagem se a primeira falhar
            if (!textViews) {
                textViews = $('.manga-info-views, .view-count, .post-total-views').first().text().trim();
            }

            const novasViews = parseViews(textViews);
            
            if(novasViews > 0) {
                let viewsOntemSalvar = obra.views_ontem || 0;
                
                // Mágica diária: Se mudou de dia desde a última checagem, a View Atual de antes vira a View de Ontem
                if(obra.data_verificacao !== hojeStr) {
                    viewsOntemSalvar = obra.views_totais || 0;
                }
                
                await supabase.from('obras').update({ 
                    views_totais: novasViews, 
                    views_ontem: viewsOntemSalvar, 
                    data_verificacao: hojeStr 
                }).eq('id', obra.id);
                
                console.log(`✅ ${obra.nome} atualizada: ${novasViews} views.`);
            } else {
                console.log(`⚠️ Falha ao encontrar número válido em ${obra.nome}.`);
            }
            
            // Pausa obrigatória de 3 segundos para evitar bloqueios do Cloudflare/Servidor
            await new Promise(r => setTimeout(r, 3000));
        } catch(e) {
            console.error(`🚨 Erro em ${obra.nome}:`, e.message);
        }
    }
    console.log("🏁 Tarefa concluída!");
}

run();
