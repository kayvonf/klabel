import weakdb


db = weakdb.WeakDB()
db.load_linden("linden_assets", "backhand")
db.save_json("lfviz_assets")
