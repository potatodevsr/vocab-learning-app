import { fetchAPI } from "@/lib/api";
import { API_URL } from "@/constants/config";
import type { CefrLevel, OxfordWord } from "@/lib/types";

export const getWordsByLevel = async (level: CefrLevel) => {
    const data = await fetchAPI<OxfordWord[]>({
        url: `${API_URL}/VocabWord`,
        params: {
            where: { level },
        },
    });
    return data ?? [];
};