import weakdb


db = weakdb.WeakDB()
db.load_linden("lfviz_assets", "lfviz_assets", "backhand")
db.save_json()
