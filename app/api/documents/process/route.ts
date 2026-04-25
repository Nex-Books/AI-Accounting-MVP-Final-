import { createClient } from '@/lib/supabase/server'
import { GoogleGenAI } from '@google/genai'
import * as XLSX from 'xlsx'

export async function POST(request: Request) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File
  const companyId = formData.get('companyId') as string
  const documentId = formData.get('documentId') as string | null

  if (!file || !companyId) {
    return Response.json({ error: 'Missing file or companyId' }, { status: 400 })
  }

  try {
    const fileName = file.name.toLowerCase()
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    let extractedData: Record<string, unknown> | null = null

    // Excel/CSV processing
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(sheet)
      
      extractedData = {
        type: 'spreadsheet',
        sheetName,
        totalRows: jsonData.length,
        columns: jsonData.length > 0 ? Object.keys(jsonData[0] as object) : [],
        rows: jsonData,
      }
    }
    // Image and PDF processing with Gemini 2.5 Flash
    else if (fileName.match(/\.(png|jpg|jpeg|gif|webp|pdf)$/)) {
      const base64 = fileBuffer.toString('base64')
      let mediaType = 'image/png'
      if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) mediaType = 'image/jpeg'
      else if (fileName.endsWith('.gif')) mediaType = 'image/gif'
      else if (fileName.endsWith('.webp')) mediaType = 'image/webp'
      else if (fileName.endsWith('.pdf')) mediaType = 'application/pdf'

      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })

        const ocrResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            {
              role: 'user',
              parts: [
                { text: `Extract from this invoice, bill, or bank statement. Return ONLY a valid JSON object with keys: vendor (string), date (YYYY-MM-DD string), invoice_number (string or null), total (number), subtotal (number or null), tax (number or null), tax_rate (string or null), currency (default INR), line_items (array of {description, quantity, unit_price, amount}), payment_mode (string or null). Use null for any field not found.` },
                {
                  inlineData: {
                    data: base64,
                    mimeType: mediaType,
                  },
                },
              ],
            },
          ],
        })

        const content = ocrResponse.text || '{}'
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/)
          extractedData = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: content, parseError: true }
        } catch {
          extractedData = { raw: content, parseError: true }
        }

        if (documentId) {
          await supabase.from('documents').update({ ocr_extracted_data: extractedData, ocr_status: 'completed' })
            .eq('id', documentId).eq('company_id', companyId)
        }
      } catch (ocrError: unknown) {
        const errorMessage = ocrError instanceof Error ? ocrError.message : 'File extraction failed'
        if (documentId) {
          await supabase.from('documents').update({ ocr_status: 'failed' }).eq('id', documentId).eq('company_id', companyId)
        }
        return Response.json({ error: errorMessage, ocrFailed: true }, { status: 500 })
      }
    } else {
      return Response.json({ error: 'Unsupported file type' }, { status: 400 })
    }

    // Store document if not already stored
    if (!documentId) {
      // Upload the file to Supabase Storage first
      const storagePath = `${companyId}/${Date.now()}_${file.name}`
      const { error: storageError } = await supabase.storage
        .from('documents')
        .upload(storagePath, fileBuffer, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        })

      if (storageError) {
        // Non-fatal — log and continue without storage path
        console.error('Storage upload error:', storageError.message)
      }

      const { data: doc, error: docError } = await supabase
        .from('documents')
        .insert({
          company_id: companyId,
          file_name: file.name,
          file_type: file.type,
          file_size_bytes: file.size,
          storage_path: storageError ? '' : storagePath,
          uploaded_by: user.id,
          ocr_status: extractedData ? 'completed' : 'pending',
          ocr_extracted_data: extractedData,
        })
        .select('id')
        .single()

      if (docError) {
        return Response.json({ error: docError.message }, { status: 500 })
      }

      // Track doc upload usage
      const { data: company } = await supabase
        .from('companies')
        .select('docs_uploaded_month')
        .eq('id', companyId)
        .single()

      await supabase
        .from('companies')
        .update({ docs_uploaded_month: (company?.docs_uploaded_month ?? 0) + 1 })
        .eq('id', companyId)

      return Response.json({
        success: true,
        documentId: doc.id,
        extractedData,
        storagePath: storageError ? null : storagePath,
      })
    }

    return Response.json({
      success: true,
      documentId,
      extractedData,
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: errorMessage }, { status: 500 })
  }
}
