import type { MetadataRoute } from "next";
export default function manifest():MetadataRoute.Manifest{return{name:"CPM LMS",short_name:"CPM",description:"Учебный кабинет CPM",start_url:"/",display:"standalone",background_color:"#ffffff",theme_color:"#4f46e5",lang:"ru",icons:[{src:"/favicon.ico",sizes:"any",type:"image/x-icon"}]}}
