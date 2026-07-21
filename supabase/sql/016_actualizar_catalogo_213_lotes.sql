-- 016_actualizar_catalogo_213_lotes.sql
-- Generado desde supabase-las-lomas-nuevo.xlsx. No editar filas manualmente.
-- Conserva el id de los lotes existentes para no romper relaciones del CRM.

begin;

do $$
begin
  if exists (select 1 from public.clientes)
     or exists (select 1 from public.separaciones)
     or exists (select 1 from public.historial_lotes)
     or exists (select 1 from public.leads_publicos)
     or exists (select 1 from public.meta_lead_events)
     or exists (select 1 from public.seguimientos_clientes)
     or exists (select 1 from public.metas_comerciales)
     or exists (select 1 from public.cotizaciones)
     or exists (select 1 from public.separacion_expedientes)
     or exists (select 1 from public.separacion_documentos)
  then
    raise exception 'La migracion del catalogo requiere los datos operativos limpios. Ejecuta primero 015_crm_preparar_produccion.sql.';
  end if;
end $$;

create temporary table nuevo_catalogo_las_lomas (
  id bigint primary key,
  mz text not null,
  lote integer not null,
  area numeric not null,
  precio numeric not null,
  estado text not null,
  svg_id text not null unique,
  unique (mz, lote)
) on commit drop;

insert into nuevo_catalogo_las_lomas
  (id, mz, lote, area, precio, estado, svg_id)
values
  (1, 'A', 1, 110.86, 24999.00, 'DISPONIBLE', 'path1205'),
  (2, 'A', 2, 122.77, 24999.00, 'DISPONIBLE', 'path1197'),
  (3, 'A', 3, 113.41, 22999.00, 'DISPONIBLE', 'path1198'),
  (4, 'A', 4, 139.10, 29999.00, 'DISPONIBLE', 'path1199'),
  (5, 'B', 1, 119.00, 26999.00, 'DISPONIBLE', 'path1196'),
  (6, 'B', 2, 119.00, 22999.00, 'DISPONIBLE', 'path1195'),
  (7, 'B', 3, 119.00, 22999.00, 'DISPONIBLE', 'path1194'),
  (8, 'B', 4, 119.00, 22999.00, 'DISPONIBLE', 'path1193'),
  (9, 'B', 5, 117.87, 24999.00, 'DISPONIBLE', 'path1192'),
  (10, 'B', 6, 117.87, 24999.00, 'DISPONIBLE', 'path1191'),
  (11, 'B', 7, 119.00, 22999.00, 'DISPONIBLE', 'path1190'),
  (12, 'B', 8, 119.00, 22999.00, 'DISPONIBLE', 'path1189'),
  (13, 'B', 9, 199.24, 43999.00, 'DISPONIBLE', 'path1188'),
  (14, 'C', 1, 150.77, 33999.00, 'DISPONIBLE', 'path1186'),
  (15, 'C', 2, 105.41, 21999.00, 'DISPONIBLE', 'path1185'),
  (16, 'C', 3, 115.27, 23999.00, 'DISPONIBLE', 'path1187'),
  (17, 'C', 4, 110.74, 21999.00, 'DISPONIBLE', 'path1181'),
  (18, 'C', 5, 103.29, 19999.00, 'DISPONIBLE', 'path1182'),
  (19, 'C', 6, 109.26, 21999.00, 'DISPONIBLE', 'path1183'),
  (20, 'C', 7, 115.22, 22999.00, 'DISPONIBLE', 'path3118'),
  (21, 'C', 8, 121.19, 23999.00, 'DISPONIBLE', 'path3119'),
  (22, 'C', 9, 127.16, 24999.00, 'DISPONIBLE', 'path3120'),
  (23, 'C', 10, 133.12, 25999.00, 'DISPONIBLE', 'path3121'),
  (24, 'C', 11, 139.09, 26999.00, 'DISPONIBLE', 'path3122'),
  (25, 'C', 12, 145.05, 28999.00, 'DISPONIBLE', 'path3123'),
  (26, 'C', 13, 151.02, 29999.00, 'DISPONIBLE', 'path3124'),
  (27, 'C', 14, 155.17, 29999.00, 'DISPONIBLE', 'path3125'),
  (28, 'C', 15, 164.92, 34999.00, 'DISPONIBLE', 'path1184'),
  (29, 'C', 16, 157.80, 30999.00, 'DISPONIBLE', 'path3126'),
  (31, 'D', 1, 119.57, 23999.00, 'DISPONIBLE', 'path1180'),
  (32, 'D', 2, 119.00, 25999.00, 'DISPONIBLE', 'path1179'),
  (33, 'D', 3, 119.00, 22999.00, 'DISPONIBLE', 'path1178'),
  (34, 'D', 4, 119.00, 22999.00, 'DISPONIBLE', 'path1177'),
  (35, 'D', 5, 119.00, 22999.00, 'DISPONIBLE', 'path1176'),
  (36, 'D', 6, 119.00, 22999.00, 'DISPONIBLE', 'path1175'),
  (37, 'D', 7, 119.00, 22999.00, 'DISPONIBLE', 'path1174'),
  (38, 'D', 8, 117.87, 26999.00, 'DISPONIBLE', 'path1173'),
  (39, 'D', 9, 117.87, 26999.00, 'DISPONIBLE', 'path1172'),
  (40, 'D', 10, 119.00, 22999.00, 'DISPONIBLE', 'path1171'),
  (41, 'D', 11, 119.00, 22999.00, 'DISPONIBLE', 'path1170'),
  (42, 'D', 12, 119.00, 22999.00, 'DISPONIBLE', 'path1169'),
  (43, 'D', 13, 119.00, 22999.00, 'DISPONIBLE', 'path1168'),
  (44, 'D', 14, 119.00, 22999.00, 'DISPONIBLE', 'path1167'),
  (45, 'D', 15, 119.00, 22999.00, 'DISPONIBLE', 'path1166'),
  (46, 'D', 16, 119.57, 25999.00, 'DISPONIBLE', 'path1165'),
  (47, 'E', 1, 119.57, 25999.00, 'DISPONIBLE', 'path1163'),
  (48, 'E', 2, 119.00, 22999.00, 'DISPONIBLE', 'path1162'),
  (49, 'E', 3, 119.00, 22999.00, 'DISPONIBLE', 'path1161'),
  (50, 'E', 4, 119.00, 22999.00, 'DISPONIBLE', 'path1160'),
  (51, 'E', 5, 119.00, 22999.00, 'DISPONIBLE', 'path1159'),
  (52, 'E', 6, 119.00, 22999.00, 'DISPONIBLE', 'path1158'),
  (53, 'E', 7, 119.00, 22999.00, 'DISPONIBLE', 'path1157'),
  (54, 'E', 8, 117.87, 24999.00, 'DISPONIBLE', 'path1156'),
  (55, 'E', 9, 117.87, 24999.00, 'DISPONIBLE', 'path1155'),
  (56, 'E', 10, 119.00, 22999.00, 'DISPONIBLE', 'path1154'),
  (57, 'E', 11, 119.00, 22999.00, 'DISPONIBLE', 'path1153'),
  (58, 'E', 12, 119.00, 22999.00, 'DISPONIBLE', 'path1152'),
  (59, 'E', 13, 119.00, 22999.00, 'DISPONIBLE', 'path1151'),
  (60, 'E', 14, 119.00, 24999.00, 'DISPONIBLE', 'path1150'),
  (61, 'E', 15, 119.00, 24999.00, 'DISPONIBLE', 'path1149'),
  (62, 'E', 16, 119.57, 26999.00, 'DISPONIBLE', 'path1164'),
  (63, 'F', 1, 151.87, 32999.00, 'DISPONIBLE', 'path1203'),
  (64, 'F', 2, 165.49, 31999.00, 'DISPONIBLE', 'path2795'),
  (65, 'F', 3, 140.94, 27999.00, 'DISPONIBLE', 'path1202'),
  (66, 'F', 4, 140.91, 27999.00, 'DISPONIBLE', 'path1201'),
  (67, 'F', 5, 148.51, 31999.00, 'DISPONIBLE', 'path1200'),
  (68, 'F', 6, 120.60, 23999.00, 'DISPONIBLE', 'path2831'),
  (69, 'F', 7, 120.60, 23999.00, 'DISPONIBLE', 'path2832'),
  (70, 'F', 8, 120.60, 24999.00, 'DISPONIBLE', 'path2833'),
  (71, 'F', 9, 120.60, 23999.00, 'DISPONIBLE', 'path2834'),
  (72, 'F', 10, 120.60, 23999.00, 'DISPONIBLE', 'path2835'),
  (73, 'F', 11, 120.60, 23999.00, 'DISPONIBLE', 'path2836'),
  (74, 'F', 12, 120.60, 23999.00, 'DISPONIBLE', 'path2837'),
  (75, 'F', 13, 120.60, 23999.00, 'DISPONIBLE', 'path2838'),
  (76, 'F', 14, 120.60, 23999.00, 'DISPONIBLE', 'path2839'),
  (77, 'F', 15, 195.38, 41999.00, 'DISPONIBLE', 'path2840'),
  (78, 'F', 16, 197.68, 41999.00, 'DISPONIBLE', 'path2841'),
  (79, 'F', 17, 107.44, 20999.00, 'DISPONIBLE', 'path2842'),
  (80, 'F', 18, 109.55, 21999.00, 'DISPONIBLE', 'path2843'),
  (81, 'F', 19, 111.66, 21999.00, 'DISPONIBLE', 'path2844'),
  (82, 'G', 1, 125.58, 26999.00, 'DISPONIBLE', 'path3330'),
  (83, 'G', 2, 119.00, 22999.00, 'DISPONIBLE', 'path3371'),
  (84, 'G', 3, 119.00, 22999.00, 'DISPONIBLE', 'path3329'),
  (85, 'G', 4, 117.88, 24999.00, 'DISPONIBLE', 'path3366'),
  (86, 'G', 5, 119.00, 24999.00, 'DISPONIBLE', 'path3367'),
  (87, 'G', 6, 119.00, 24999.00, 'DISPONIBLE', 'path3368'),
  (88, 'G', 7, 119.00, 24999.00, 'DISPONIBLE', 'path3369'),
  (89, 'G', 8, 117.88, 24999.00, 'DISPONIBLE', 'path3370'),
  (90, 'G', 9, 119.00, 22999.00, 'DISPONIBLE', 'path3328'),
  (91, 'G', 10, 119.00, 22999.00, 'DISPONIBLE', 'path3327'),
  (92, 'G', 11, 119.00, 22999.00, 'DISPONIBLE', 'path3326'),
  (93, 'G', 12, 113.12, 21999.00, 'DISPONIBLE', 'path3373'),
  (94, 'H', 1, 119.00, 26999.00, 'DISPONIBLE', 'path1147'),
  (95, 'H', 2, 119.00, 22999.00, 'DISPONIBLE', 'path1146'),
  (96, 'H', 3, 119.00, 22999.00, 'DISPONIBLE', 'path1144'),
  (97, 'H', 4, 119.00, 22999.00, 'DISPONIBLE', 'path1141'),
  (98, 'H', 5, 117.87, 24999.00, 'DISPONIBLE', 'path1140'),
  (99, 'H', 6, 117.87, 24999.00, 'DISPONIBLE', 'path1204'),
  (100, 'H', 7, 119.00, 22999.00, 'DISPONIBLE', 'path1142'),
  (101, 'H', 8, 119.00, 22999.00, 'DISPONIBLE', 'path1143'),
  (102, 'H', 9, 119.00, 22999.00, 'DISPONIBLE', 'path1145'),
  (103, 'H', 10, 119.00, 26999.00, 'DISPONIBLE', 'path1148'),
  (104, 'I', 1, 119.00, 26999.00, 'DISPONIBLE', 'path1134'),
  (105, 'I', 2, 119.00, 22999.00, 'DISPONIBLE', 'path1133'),
  (106, 'I', 3, 119.00, 22999.00, 'DISPONIBLE', 'path1132'),
  (107, 'I', 4, 119.00, 22999.00, 'DISPONIBLE', 'path1131'),
  (108, 'I', 5, 119.00, 22999.00, 'DISPONIBLE', 'path1120'),
  (109, 'I', 6, 119.00, 22999.00, 'DISPONIBLE', 'path1121'),
  (110, 'I', 7, 119.00, 22999.00, 'DISPONIBLE', 'path1124'),
  (111, 'I', 8, 119.00, 22999.00, 'DISPONIBLE', 'path1126'),
  (112, 'I', 9, 119.00, 22999.00, 'DISPONIBLE', 'path1128'),
  (113, 'I', 10, 117.86, 24999.00, 'DISPONIBLE', 'path1129'),
  (114, 'I', 11, 117.86, 24999.00, 'DISPONIBLE', 'path1130'),
  (115, 'I', 12, 119.00, 22999.00, 'DISPONIBLE', 'path1127'),
  (116, 'I', 13, 119.00, 22999.00, 'DISPONIBLE', 'path1125'),
  (117, 'I', 14, 119.00, 22999.00, 'DISPONIBLE', 'path1123'),
  (118, 'I', 15, 119.00, 22999.00, 'DISPONIBLE', 'path1122'),
  (119, 'I', 16, 119.00, 22999.00, 'DISPONIBLE', 'path1139'),
  (120, 'I', 17, 119.00, 22999.00, 'DISPONIBLE', 'path1138'),
  (121, 'I', 18, 119.00, 22999.00, 'DISPONIBLE', 'path1137'),
  (122, 'I', 19, 119.00, 22999.00, 'DISPONIBLE', 'path1136'),
  (123, 'I', 20, 119.00, 26999.00, 'DISPONIBLE', 'path1135'),
  (124, 'J', 1, 163.32, 36999.00, 'DISPONIBLE', 'path1115'),
  (125, 'J', 2, 142.50, 29999.00, 'DISPONIBLE', 'path1114'),
  (126, 'J', 3, 142.50, 27999.00, 'DISPONIBLE', 'path1113'),
  (127, 'J', 4, 142.50, 27999.00, 'DISPONIBLE', 'path1098'),
  (128, 'J', 5, 142.50, 27999.00, 'DISPONIBLE', 'path1100'),
  (129, 'J', 6, 142.50, 27999.00, 'DISPONIBLE', 'path1102'),
  (130, 'J', 7, 142.50, 27999.00, 'DISPONIBLE', 'path1104'),
  (131, 'J', 8, 142.50, 27999.00, 'DISPONIBLE', 'path1106'),
  (132, 'J', 9, 142.50, 27999.00, 'DISPONIBLE', 'path1108'),
  (133, 'J', 10, 142.50, 27999.00, 'DISPONIBLE', 'path1110'),
  (134, 'J', 11, 141.38, 29999.00, 'DISPONIBLE', 'path1111'),
  (135, 'J', 12, 137.04, 28999.00, 'DISPONIBLE', 'path1112'),
  (136, 'J', 13, 138.51, 26999.00, 'DISPONIBLE', 'path1109'),
  (137, 'J', 14, 137.98, 26999.00, 'DISPONIBLE', 'path1107'),
  (138, 'J', 15, 137.45, 26999.00, 'DISPONIBLE', 'path1105'),
  (139, 'J', 16, 136.92, 26999.00, 'DISPONIBLE', 'path1103'),
  (140, 'J', 17, 136.38, 26999.00, 'DISPONIBLE', 'path1101'),
  (141, 'J', 18, 135.85, 26999.00, 'DISPONIBLE', 'path1099'),
  (142, 'J', 19, 135.32, 26999.00, 'DISPONIBLE', 'path1119'),
  (143, 'J', 20, 134.79, 26999.00, 'DISPONIBLE', 'path1118'),
  (144, 'J', 21, 134.26, 25999.00, 'DISPONIBLE', 'path1117'),
  (145, 'J', 22, 131.73, 27999.00, 'DISPONIBLE', 'path1116'),
  (146, 'K', 1, 150.17, 31999.00, 'DISPONIBLE', 'path1057'),
  (147, 'K', 2, 119.00, 22999.00, 'DISPONIBLE', 'path1058'),
  (148, 'K', 3, 119.00, 22999.00, 'DISPONIBLE', 'path1037'),
  (149, 'K', 4, 119.00, 22999.00, 'DISPONIBLE', 'path1038'),
  (150, 'K', 5, 119.00, 22999.00, 'DISPONIBLE', 'path1039'),
  (151, 'K', 6, 119.00, 22999.00, 'DISPONIBLE', 'path1040'),
  (152, 'K', 7, 119.00, 22999.00, 'DISPONIBLE', 'path1041'),
  (153, 'K', 8, 119.00, 22999.00, 'DISPONIBLE', 'path1042'),
  (154, 'K', 9, 119.00, 22999.00, 'DISPONIBLE', 'path1043'),
  (155, 'K', 10, 119.00, 22999.00, 'DISPONIBLE', 'path1044'),
  (156, 'K', 11, 137.50, 29999.00, 'DISPONIBLE', 'path1045'),
  (157, 'K', 12, 140.26, 29999.00, 'DISPONIBLE', 'path1046'),
  (158, 'K', 13, 119.00, 22999.00, 'DISPONIBLE', 'path1054'),
  (159, 'K', 14, 119.00, 22999.00, 'DISPONIBLE', 'path1053'),
  (160, 'K', 15, 119.00, 22999.00, 'DISPONIBLE', 'path1052'),
  (161, 'K', 16, 119.00, 22999.00, 'DISPONIBLE', 'path1051'),
  (162, 'K', 17, 119.00, 22999.00, 'DISPONIBLE', 'path1050'),
  (163, 'K', 18, 119.00, 22999.00, 'DISPONIBLE', 'path1049'),
  (164, 'K', 19, 119.00, 22999.00, 'DISPONIBLE', 'path1048'),
  (165, 'K', 20, 119.00, 22999.00, 'DISPONIBLE', 'path1047'),
  (166, 'K', 21, 119.00, 22999.00, 'DISPONIBLE', 'path1055'),
  (167, 'K', 22, 150.17, 31999.00, 'DISPONIBLE', 'path1056'),
  (168, 'L', 1, 130.93, 27999.00, 'DISPONIBLE', 'path1075'),
  (169, 'L', 2, 135.52, 26999.00, 'DISPONIBLE', 'path1076'),
  (170, 'L', 3, 119.00, 22999.00, 'DISPONIBLE', 'path1077'),
  (171, 'L', 4, 119.00, 22999.00, 'DISPONIBLE', 'path1078'),
  (172, 'L', 5, 119.00, 22999.00, 'DISPONIBLE', 'path1079'),
  (173, 'L', 6, 119.00, 22999.00, 'DISPONIBLE', 'path1080'),
  (174, 'L', 7, 119.00, 22999.00, 'DISPONIBLE', 'path1081'),
  (175, 'L', 8, 119.00, 22999.00, 'DISPONIBLE', 'path1082'),
  (176, 'L', 9, 119.00, 22999.00, 'DISPONIBLE', 'path1083'),
  (177, 'L', 10, 119.00, 24999.00, 'DISPONIBLE', 'path1084'),
  (178, 'L', 11, 119.00, 24999.00, 'DISPONIBLE', 'path1085'),
  (179, 'L', 12, 119.00, 24999.00, 'DISPONIBLE', 'path1086'),
  (180, 'L', 13, 119.00, 24999.00, 'DISPONIBLE', 'path1087'),
  (181, 'L', 14, 119.00, 22999.00, 'DISPONIBLE', 'path1088'),
  (182, 'L', 15, 119.00, 22999.00, 'DISPONIBLE', 'path1089'),
  (183, 'L', 16, 119.00, 22999.00, 'DISPONIBLE', 'path1090'),
  (184, 'L', 17, 119.00, 22999.00, 'DISPONIBLE', 'path1091'),
  (185, 'L', 18, 117.87, 24999.00, 'DISPONIBLE', 'path1092'),
  (186, 'L', 19, 118.87, 25999.00, 'DISPONIBLE', 'path1073'),
  (187, 'L', 20, 119.00, 22999.00, 'DISPONIBLE', 'path1072'),
  (188, 'L', 21, 119.00, 22999.00, 'DISPONIBLE', 'path1071'),
  (189, 'L', 22, 119.00, 22999.00, 'DISPONIBLE', 'path1070'),
  (190, 'L', 23, 119.00, 22999.00, 'DISPONIBLE', 'path1069'),
  (191, 'L', 24, 119.00, 22999.00, 'DISPONIBLE', 'path1068'),
  (192, 'L', 25, 119.00, 22999.00, 'DISPONIBLE', 'path1067'),
  (193, 'L', 26, 119.00, 22999.00, 'DISPONIBLE', 'path1066'),
  (194, 'L', 27, 119.00, 22999.00, 'DISPONIBLE', 'path1065'),
  (195, 'L', 28, 119.00, 22999.00, 'DISPONIBLE', 'path1064'),
  (196, 'L', 29, 119.00, 22999.00, 'DISPONIBLE', 'path1063'),
  (197, 'L', 30, 119.00, 22999.00, 'DISPONIBLE', 'path1062'),
  (198, 'L', 31, 119.00, 22999.00, 'DISPONIBLE', 'path1061'),
  (199, 'L', 32, 119.00, 22999.00, 'DISPONIBLE', 'path1060'),
  (200, 'L', 33, 119.00, 22999.00, 'DISPONIBLE', 'path1059'),
  (201, 'L', 34, 119.00, 22999.00, 'DISPONIBLE', 'path1096'),
  (202, 'L', 35, 119.00, 22999.00, 'DISPONIBLE', 'path1097'),
  (203, 'L', 36, 119.00, 22999.00, 'DISPONIBLE', 'path1093'),
  (204, 'L', 37, 119.00, 22999.00, 'DISPONIBLE', 'path1094'),
  (205, 'L', 38, 239.01, 50999.00, 'DISPONIBLE', 'path1095'),
  (206, 'L', 39, 135.52, 26999.00, 'DISPONIBLE', 'path1074'),
  (207, 'F', 20, 113.76, 21999.00, 'DISPONIBLE', 'path2845'),
  (208, 'F', 21, 115.87, 22999.00, 'DISPONIBLE', 'path2846'),
  (209, 'F', 22, 117.98, 22999.00, 'DISPONIBLE', 'path2847'),
  (210, 'F', 23, 120.09, 23999.00, 'DISPONIBLE', 'path2848'),
  (211, 'F', 24, 122.20, 23999.00, 'DISPONIBLE', 'path2849'),
  (212, 'F', 25, 124.31, 24999.00, 'DISPONIBLE', 'path2850'),
  (213, 'F', 26, 126.41, 24999.00, 'DISPONIBLE', 'path2851'),
  (214, 'G', 13, 104.02, 22999.00, 'DISPONIBLE', 'path3372');

-- Los datos operativos ya estan vacios. Sustituir el catalogo completo evita
-- colisiones entre svg_id antiguos y nuevos durante una actualizacion parcial.
delete from public.las_lomas_lotes;

insert into public.las_lomas_lotes
  (id, mz, lote, area, precio, estado, svg_id, cliente_id, asesor_id, updated_at)
select
  id, mz, lote, area, precio, estado, svg_id, null, null, now()
from nuevo_catalogo_las_lomas
on conflict (id) do update
set mz = excluded.mz,
    lote = excluded.lote,
    area = excluded.area,
    precio = excluded.precio,
    estado = excluded.estado,
    svg_id = excluded.svg_id,
    cliente_id = null,
    asesor_id = null,
    updated_at = now();

do $$
declare
  total bigint;
begin
  select count(*) into total from public.las_lomas_lotes;
  if total <> 213 then
    raise exception 'Catalogo incompleto: se esperaban 213 lotes y quedaron %', total;
  end if;
end $$;

select setval(
  pg_get_serial_sequence('public.las_lomas_lotes', 'id'),
  (select max(id) from public.las_lomas_lotes),
  true
)
where pg_get_serial_sequence('public.las_lomas_lotes', 'id') is not null;

commit;

select count(*)::bigint as total_lotes from public.las_lomas_lotes;
select mz, count(*)::bigint as lotes
from public.las_lomas_lotes
group by mz
order by mz;
